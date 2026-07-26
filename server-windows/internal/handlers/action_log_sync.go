package handlers

import (
	"errors"
	"log"
	"strings"
	"time"

	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

func createPollActionLog(hardwareID, action, payload string, windowsCommandID uint) (uint, error) {
	if strings.TrimSpace(payload) == "" {
		payload = action
	}

	entry := models.DeviceCommandLog{
		DeviceID:         hardwareID,
		CommandName:      action,
		Payload:          payload,
		Status:           models.CommandLogStatusPending,
		WindowsCommandID: &windowsCommandID,
	}

	if err := db.DB.Create(&entry).Error; err != nil {
		return 0, err
	}

	return entry.ID, nil
}

func completePollActionLog(command models.WindowsDeviceCommand, success bool, message string) {
	status := models.CommandLogStatusFailed
	if success {
		status = models.CommandLogStatusSuccess
	}

	now := time.Now()
	output := strings.TrimSpace(message)
	payload := payloadString(command.Payload)
	if payload == "" {
		payload = command.Action
	}

	var entry models.DeviceCommandLog
	err := db.DB.Where("windows_command_id = ?", command.ID).First(&entry).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		entry = models.DeviceCommandLog{
			DeviceID:         command.HardwareID,
			CommandName:      command.Action,
			Payload:          payload,
			Status:           status,
			Output:           output,
			ExecutedAt:       &now,
			WindowsCommandID: &command.ID,
		}
		if createErr := db.DB.Create(&entry).Error; createErr != nil {
			log.Printf("[complete-command] create action log failed: command_id=%d err=%v", command.ID, createErr)
		}
		return
	}
	if err != nil {
		log.Printf("[complete-command] lookup action log failed: command_id=%d err=%v", command.ID, err)
		return
	}

	entry.Status = status
	entry.Output = output
	entry.ExecutedAt = &now
	if strings.TrimSpace(entry.Payload) == "" {
		entry.Payload = payload
	}

	if saveErr := db.DB.Save(&entry).Error; saveErr != nil {
		log.Printf("[complete-command] update action log failed: command_id=%d log_id=%d err=%v", command.ID, entry.ID, saveErr)
	}
}
