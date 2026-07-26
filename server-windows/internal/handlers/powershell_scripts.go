package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// ListPowerShellScripts returns saved PowerShell scripts.
func (h *WindowsHandler) ListPowerShellScripts(c *gin.Context) {
	var scripts []models.PowerShellScript
	var total int64

	if err := db.DB.Model(&models.PowerShellScript{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count scripts"})
		return
	}

	if err := db.DB.Order("updated_at DESC, id DESC").Find(&scripts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list scripts"})
		return
	}

	items := make([]models.PowerShellScriptJSON, 0, len(scripts))
	for _, script := range scripts {
		items = append(items, models.ToPowerShellScriptJSON(script))
	}

	c.JSON(http.StatusOK, models.PowerShellScriptListResponse{
		Items:           items,
		TotalItemsCount: total,
	})
}

// GetPowerShellScript returns one saved script.
func (h *WindowsHandler) GetPowerShellScript(c *gin.Context) {
	scriptID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid script id"})
		return
	}

	var script models.PowerShellScript
	if err := db.DB.First(&script, scriptID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "script not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup script"})
		return
	}

	c.JSON(http.StatusOK, models.ToPowerShellScriptJSON(script))
}

// CreatePowerShellScript stores a new script.
func (h *WindowsHandler) CreatePowerShellScript(c *gin.Context) {
	var req models.UpsertPowerShellScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	content := strings.TrimSpace(req.Content)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	script := models.PowerShellScript{
		Name:             name,
		Description:      strings.TrimSpace(req.Description),
		Content:          content,
		ExecutionContext: models.NormalizePowerShellExecutionContext(req.ExecutionContext),
	}

	if err := db.DB.Create(&script).Error; err != nil {
		log.Printf("[create-powershell-script] save failed: name=%q err=%v", name, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create script"})
		return
	}

	log.Printf("[create-powershell-script] created id=%d name=%q", script.ID, script.Name)
	c.JSON(http.StatusCreated, models.ToPowerShellScriptJSON(script))
}

// UpdatePowerShellScript updates an existing script.
func (h *WindowsHandler) UpdatePowerShellScript(c *gin.Context) {
	scriptID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid script id"})
		return
	}

	var req models.UpsertPowerShellScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	content := strings.TrimSpace(req.Content)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	var script models.PowerShellScript
	if err := db.DB.First(&script, scriptID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "script not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup script"})
		return
	}

	script.Name = name
	script.Description = strings.TrimSpace(req.Description)
	script.Content = content
	script.ExecutionContext = models.NormalizePowerShellExecutionContext(req.ExecutionContext)

	if err := db.DB.Save(&script).Error; err != nil {
		log.Printf("[update-powershell-script] save failed: id=%d err=%v", scriptID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update script"})
		return
	}

	log.Printf("[update-powershell-script] updated id=%d name=%q", script.ID, script.Name)
	c.JSON(http.StatusOK, models.ToPowerShellScriptJSON(script))
}

// DeletePowerShellScript removes a saved script.
func (h *WindowsHandler) DeletePowerShellScript(c *gin.Context) {
	scriptID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid script id"})
		return
	}

	result := db.DB.Delete(&models.PowerShellScript{}, scriptID)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete script"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "script not found"})
		return
	}

	log.Printf("[delete-powershell-script] deleted id=%d", scriptID)
	c.Status(http.StatusNoContent)
}
