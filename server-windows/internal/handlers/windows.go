package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

const mockAuthToken = "mock-jwt-token-777"

// WindowsHandler serves REST endpoints for the Windows MDM agent.
type WindowsHandler struct{}

// NewWindowsHandler creates a Windows agent API handler.
func NewWindowsHandler() *WindowsHandler {
	return &WindowsHandler{}
}

// Enroll accepts an enrollment token and hardware ID, returning a mock JWT.
func (h *WindowsHandler) Enroll(c *gin.Context) {
	var req models.EnrollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var device models.WindowsDevice
	err := db.DB.Where("hardware_id = ?", req.HardwareID).First(&device).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		device = models.WindowsDevice{
			HardwareID:      req.HardwareID,
			EnrollmentToken: req.EnrollmentToken,
		}
		if err := db.DB.Create(&device).Error; err != nil {
			log.Printf("[enroll] create device failed: hardware_id=%q err=%v", req.HardwareID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create device"})
			return
		}
		log.Printf("[enroll] created device hardware_id=%q token=%q", req.HardwareID, req.EnrollmentToken)
	} else if err != nil {
		log.Printf("[enroll] lookup failed: hardware_id=%q err=%v", req.HardwareID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup device"})
		return
	} else {
		log.Printf("[enroll] existing device hardware_id=%q", req.HardwareID)
	}

	c.JSON(http.StatusOK, models.EnrollResponse{
		AuthToken: mockAuthToken,
	})
}

// Inventory accepts authenticated inventory uploads from enrolled agents.
func (h *WindowsHandler) Inventory(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
		return
	}

	deviceID := c.GetHeader("X-Device-Id")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-Device-Id header"})
		return
	}

	var req models.InventoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var device models.WindowsDevice
	if err := db.DB.Where("hardware_id = ?", deviceID).First(&device).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		log.Printf("[inventory] lookup failed: hardware_id=%q err=%v", deviceID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup device"})
		return
	}

	device.Hostname = req.Hostname
	device.OSVersion = req.OSVersion
	device.CPU = req.CPU
	device.RAM_GB = req.RAM_GB
	device.DiskTotal_GB = req.DiskTotal_GB
	device.DiskUsed_GB = req.DiskUsed_GB
	device.LastCheckin = time.Now()

	if err := db.DB.Save(&device).Error; err != nil {
		log.Printf("[inventory] save failed: hardware_id=%q err=%v", deviceID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update device"})
		return
	}

	log.Printf(
		"[inventory] updated device_id=%q hostname=%q os=%q cpu=%q ram_gb=%d disk=%d/%d gb",
		deviceID,
		req.Hostname,
		req.OSVersion,
		req.CPU,
		req.RAM_GB,
		req.DiskUsed_GB,
		req.DiskTotal_GB,
	)

	c.Status(http.StatusOK)
}

// ListDevices returns paginated Windows agents from the windows_devices table.
func (h *WindowsHandler) ListDevices(c *gin.Context) {
	pageNum := parsePositiveInt(c.DefaultQuery("pageNum", "1"), 1)
	pageSize := parsePositiveInt(c.DefaultQuery("pageSize", "50"), 50)
	if pageSize > 200 {
		pageSize = 200
	}

	searchValue := strings.TrimSpace(c.Query("value"))
	query := db.DB.Model(&models.WindowsDevice{})

	if searchValue != "" {
		like := "%" + searchValue + "%"
		query = query.Where(
			"hardware_id ILIKE ? OR hostname ILIKE ? OR os_version ILIKE ? OR cpu ILIKE ?",
			like, like, like, like,
		)
	}

	var totalItemsCount int64
	if err := query.Count(&totalItemsCount).Error; err != nil {
		log.Printf("[list-devices] count failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count devices"})
		return
	}

	offset := (pageNum - 1) * pageSize
	var devices []models.WindowsDevice
	if err := query.Order("last_checkin DESC NULLS LAST, id DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&devices).Error; err != nil {
		log.Printf("[list-devices] query failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list devices"})
		return
	}

	items := make([]models.WindowsDeviceJSON, 0, len(devices))
	for _, device := range devices {
		items = append(items, models.ToWindowsDeviceJSON(device))
	}

	c.JSON(http.StatusOK, models.WindowsDeviceListResponse{
		Items:           items,
		TotalItemsCount: totalItemsCount,
	})
}

func parsePositiveInt(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	return value
}
