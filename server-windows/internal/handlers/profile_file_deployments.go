package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// GetConfigProfileFileDeployments returns file deployment rules for a profile.
func (h *WindowsHandler) GetConfigProfileFileDeployments(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	if err := ensureConfigProfileExists(profileID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup configuration profile"})
		return
	}

	items, err := listProfileFileDeploymentRules(profileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load file deployments"})
		return
	}

	c.JSON(http.StatusOK, models.ProfileFileDeploymentsResponse{Items: items})
}

// AssignConfigProfileFileDeployments replaces file deployment rules for a profile.
func (h *WindowsHandler) AssignConfigProfileFileDeployments(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	var req models.AssignProfileFileDeploymentsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ensureConfigProfileExists(profileID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup configuration profile"})
		return
	}

	normalized, err := normalizeProfileFileDeploymentRules(req.Items)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := validateProfileFileDeploymentRules(normalized); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "one or more files were not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := replaceProfileFileDeployments(profileID, normalized); err != nil {
		log.Printf("[assign-file-deployments] profile_id=%d err=%v", profileID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file deployments"})
		return
	}

	log.Printf("[assign-file-deployments] profile_id=%d rules=%d", profileID, len(normalized))
	c.JSON(http.StatusOK, models.ProfileFileDeploymentsResponse{Items: normalized})
}

func listProfileFileDeploymentRules(profileID uint) ([]models.ProfileFileDeploymentRule, error) {
	var rows []models.ProfileFileDeployment
	if err := db.DB.Where("profile_id = ?", profileID).Order("id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}

	items := make([]models.ProfileFileDeploymentRule, 0, len(rows))
	for _, row := range rows {
		items = append(items, models.ProfileFileDeploymentRule{
			ID:               row.ID,
			FileID:           row.FileID,
			DestinationPath:  row.DestinationPath,
			Unzip:            row.Unzip,
			PostActionScript: row.PostActionScript,
		})
	}
	return items, nil
}

func normalizeProfileFileDeploymentRules(items []models.ProfileFileDeploymentRule) ([]models.ProfileFileDeploymentRule, error) {
	normalized := make([]models.ProfileFileDeploymentRule, 0, len(items))
	for _, item := range items {
		if item.FileID == 0 {
			continue
		}
		destination := strings.TrimSpace(item.DestinationPath)
		if destination == "" {
			return nil, errors.New("destination_path is required")
		}
		normalized = append(normalized, models.ProfileFileDeploymentRule{
			ID:               item.ID,
			FileID:           item.FileID,
			DestinationPath:  destination,
			Unzip:            item.Unzip,
			PostActionScript: strings.TrimSpace(item.PostActionScript),
		})
	}
	return normalized, nil
}

func validateProfileFileDeploymentRules(items []models.ProfileFileDeploymentRule) error {
	if len(items) == 0 {
		return nil
	}

	fileIDs := make([]uint, 0, len(items))
	for _, item := range items {
		fileIDs = append(fileIDs, item.FileID)
	}

	var count int64
	if err := db.DB.Model(&models.StoredFile{}).Where("id IN ?", fileIDs).Count(&count).Error; err != nil {
		return err
	}
	if int(count) != len(uniqueUintValues(fileIDs)) {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func replaceProfileFileDeployments(profileID uint, items []models.ProfileFileDeploymentRule) error {
	return db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("profile_id = ?", profileID).Delete(&models.ProfileFileDeployment{}).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}

		rows := make([]models.ProfileFileDeployment, 0, len(items))
		for _, item := range items {
			rows = append(rows, models.ProfileFileDeployment{
				ProfileID:        profileID,
				FileID:           item.FileID,
				DestinationPath:  item.DestinationPath,
				Unzip:            item.Unzip,
				PostActionScript: item.PostActionScript,
			})
		}
		return tx.Create(&rows).Error
	})
}

func deleteConfigProfileFileDeployments(profileID uint) error {
	return db.DB.Where("profile_id = ?", profileID).Delete(&models.ProfileFileDeployment{}).Error
}

func loadFileDeploymentsForProfiles(profileIDs []uint) ([]models.FileDeployment, error) {
	if len(profileIDs) == 0 {
		return nil, nil
	}

	var rows []models.ProfileFileDeployment
	if err := db.DB.Where("profile_id IN ?", profileIDs).Order("profile_id ASC, id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}

	fileIDs := make([]uint, 0, len(rows))
	for _, row := range rows {
		fileIDs = append(fileIDs, row.FileID)
	}

	var files []models.StoredFile
	if err := db.DB.Where("id IN ?", uniqueUintValues(fileIDs)).Find(&files).Error; err != nil {
		return nil, err
	}
	fileByID := make(map[uint]models.StoredFile, len(files))
	for _, file := range files {
		fileByID[file.ID] = file
	}

	seen := make(map[string]models.FileDeployment)
	order := make([]string, 0, len(rows))
	for _, row := range rows {
		file, ok := fileByID[row.FileID]
		if !ok {
			continue
		}

		key := fmt.Sprintf("%d:%s", row.FileID, row.DestinationPath)
		if _, exists := seen[key]; !exists {
			order = append(order, key)
		}

		publicPath := "/storage/files/" + file.Filename
		seen[key] = models.FileDeployment{
			ID:               row.ID,
			FileID:           file.ID,
			OriginalName:     file.OriginalName,
			DownloadURL:      publicPath,
			SizeBytes:        file.SizeBytes,
			SHA256:           file.SHA256,
			DestinationPath:  row.DestinationPath,
			Unzip:            row.Unzip,
			PostActionScript: row.PostActionScript,
			UpdatedAt:        row.UpdatedAt,
		}
	}

	deployments := make([]models.FileDeployment, 0, len(order))
	for _, key := range order {
		deployments = append(deployments, seen[key])
	}
	return deployments, nil
}

func uniqueUintValues(values []uint) []uint {
	seen := make(map[uint]struct{}, len(values))
	result := make([]uint, 0, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
