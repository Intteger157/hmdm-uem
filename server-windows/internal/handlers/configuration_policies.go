package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// GetConfigProfilePolicies returns registry policies for one configuration profile.
func (h *WindowsHandler) GetConfigProfilePolicies(c *gin.Context) {
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

	items, err := loadConfigurationPolicies(profileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load configuration policies"})
		return
	}

	c.JSON(http.StatusOK, models.ConfigurationPolicyListResponse{Items: items})
}

// ReplaceConfigProfilePolicies replaces registry policies for one configuration profile.
func (h *WindowsHandler) ReplaceConfigProfilePolicies(c *gin.Context) {
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

	var req models.ReplaceConfigurationPoliciesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := replaceConfigurationPolicies(profileID, req.Items); err != nil {
		log.Printf("[replace-config-policies] profile_id=%d err=%v", profileID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	items, err := loadConfigurationPolicies(profileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load configuration policies"})
		return
	}

	c.JSON(http.StatusOK, models.ConfigurationPolicyListResponse{Items: items})
}

// GetDeviceConfigurations returns merged registry policies assigned to one device.
func (h *WindowsHandler) GetDeviceConfigurations(c *gin.Context) {
	if !validateAgentAuth(c) {
		return
	}

	deviceID := stringsTrimDeviceHeader(c)
	if deviceID == "" {
		return
	}

	hardwareID := stringsTrimHardwareID(c)
	if hardwareID == "" {
		return
	}
	if hardwareID != deviceID {
		c.JSON(http.StatusForbidden, gin.H{"error": "hardware id mismatch"})
		return
	}

	var device models.WindowsDevice
	if err := db.DB.Where("hardware_id = ?", hardwareID).First(&device).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup device"})
		return
	}

	response, err := buildDeviceConfigurations(device)
	if err != nil {
		log.Printf("[device-configurations] build failed: hardware_id=%q err=%v", hardwareID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build device configurations"})
		return
	}

	if len(response.Policies) == 0 && response.ConfigurationID == 0 {
		c.Status(http.StatusNoContent)
		return
	}

	c.JSON(http.StatusOK, response)
}

func loadConfigurationPolicies(profileID uint) ([]models.ConfigurationPolicyJSON, error) {
	var policies []models.ConfigurationPolicy
	if err := db.DB.Where("profile_id = ?", profileID).Order("id ASC").Find(&policies).Error; err != nil {
		return nil, err
	}

	items := make([]models.ConfigurationPolicyJSON, 0, len(policies))
	for _, policy := range policies {
		items = append(items, models.ToConfigurationPolicyJSON(policy))
	}
	return items, nil
}

func replaceConfigurationPolicies(profileID uint, items []models.ConfigurationPolicyJSON) error {
	now := time.Now()
	records := make([]models.ConfigurationPolicy, 0, len(items))
	seenPaths := make(map[string]struct{}, len(items))

	for _, item := range items {
		policyPath := strings.TrimSpace(item.PolicyPath)
		if policyPath == "" {
			return errors.New("policyPath is required")
		}
		normalizedPath := strings.ToUpper(policyPath)
		if _, exists := seenPaths[normalizedPath]; exists {
			return errors.New("duplicate policyPath in request")
		}
		seenPaths[normalizedPath] = struct{}{}

		records = append(records, models.ConfigurationPolicy{
			ProfileID:  profileID,
			PolicyPath: policyPath,
			ValueType:  models.NormalizePolicyValueType(strings.TrimSpace(item.ValueType)),
			Value:      strings.TrimSpace(item.Value),
			UpdatedAt:  now,
			CreatedAt:  now,
		})
	}

	return db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("profile_id = ?", profileID).Delete(&models.ConfigurationPolicy{}).Error; err != nil {
			return err
		}
		if len(records) == 0 {
			return nil
		}
		return tx.Create(&records).Error
	})
}

func deleteConfigurationPolicies(profileID uint) error {
	return db.DB.Where("profile_id = ?", profileID).Delete(&models.ConfigurationPolicy{}).Error
}

func buildDeviceConfigurations(device models.WindowsDevice) (models.DeviceConfigurationsResponse, error) {
	effective, err := buildEffectiveConfig(device)
	if err != nil {
		return models.DeviceConfigurationsResponse{}, err
	}

	profileIDs := make([]uint, 0, len(effective.AppliedProfiles))
	for _, source := range effective.AppliedProfiles {
		profileIDs = append(profileIDs, source.ProfileID)
	}
	if len(profileIDs) == 0 {
		return models.DeviceConfigurationsResponse{}, nil
	}

	policies, err := loadMergedConfigurationPolicies(profileIDs)
	if err != nil {
		return models.DeviceConfigurationsResponse{}, err
	}

	response := models.DeviceConfigurationsResponse{
		ConfigurationID:   effective.ProfileID,
		ConfigurationName: effective.ProfileName,
		Policies:          policies,
	}
	return response, nil
}

func loadMergedConfigurationPolicies(profileIDs []uint) ([]models.ConfigurationPolicyJSON, error) {
	if len(profileIDs) == 0 {
		return nil, nil
	}

	var policies []models.ConfigurationPolicy
	if err := db.DB.Where("profile_id IN ?", profileIDs).Order("id ASC").Find(&policies).Error; err != nil {
		return nil, err
	}

	byProfile := make(map[uint][]models.ConfigurationPolicy, len(profileIDs))
	for _, policy := range policies {
		byProfile[policy.ProfileID] = append(byProfile[policy.ProfileID], policy)
	}

	merged := make(map[string]models.ConfigurationPolicyJSON, len(policies))
	for _, profileID := range profileIDs {
		for _, policy := range byProfile[profileID] {
			key := strings.ToUpper(strings.TrimSpace(policy.PolicyPath))
			merged[key] = models.ToConfigurationPolicyJSON(policy)
		}
	}

	items := make([]models.ConfigurationPolicyJSON, 0, len(merged))
	for _, item := range merged {
		items = append(items, item)
	}
	return items, nil
}
