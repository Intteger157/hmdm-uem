package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
)

// consoleSettings mirrors the fields the frontend Settings page reads today.
type consoleSettings struct {
	ID                         uint    `json:"id" gorm:"column:id"`
	BackgroundColor            *string `json:"backgroundColor" gorm:"column:backgroundcolor"`
	TextColor                  *string `json:"textColor" gorm:"column:textcolor"`
	BackgroundImageURL         *string `json:"backgroundImageUrl" gorm:"column:backgroundimageurl"`
	IconSize                   *string `json:"iconSize" gorm:"column:iconsize"`
	DesktopHeader              *string `json:"desktopHeader" gorm:"column:desktopheader"`
	DesktopHeaderTemplate      *string `json:"desktopHeaderTemplate" gorm:"column:desktopheadertemplate"`
	UseDefaultLanguage         *bool   `json:"useDefaultLanguage" gorm:"column:usedefaultlanguage"`
	Language                   *string `json:"language" gorm:"column:language"`
	CreateNewDevices           *bool   `json:"createNewDevices" gorm:"column:createnewdevices"`
	NewDeviceGroupID           *int    `json:"newDeviceGroupId" gorm:"column:newdevicegroupid"`
	NewDeviceConfigurationID   *int    `json:"newDeviceConfigurationId" gorm:"column:newdeviceconfigurationid"`
	PhoneNumberFormat          *string `json:"phoneNumberFormat" gorm:"column:phonenumberformat"`
	CustomPropertyName1        *string `json:"customPropertyName1" gorm:"column:custompropertyname1"`
	CustomPropertyName2        *string `json:"customPropertyName2" gorm:"column:custompropertyname2"`
	CustomPropertyName3        *string `json:"customPropertyName3" gorm:"column:custompropertyname3"`
	CustomMultiline1           *bool   `json:"customMultiline1" gorm:"column:custommultiline1"`
	CustomMultiline2           *bool   `json:"customMultiline2" gorm:"column:custommultiline2"`
	CustomMultiline3           *bool   `json:"customMultiline3" gorm:"column:custommultiline3"`
	CustomSend1                *bool   `json:"customSend1" gorm:"column:customsend1"`
	CustomSend2                *bool   `json:"customSend2" gorm:"column:customsend2"`
	CustomSend3                *bool   `json:"customSend3" gorm:"column:customsend3"`
	SendDescription            *bool   `json:"sendDescription" gorm:"column:senddescription"`
	PasswordLength             *int    `json:"passwordLength" gorm:"column:passwordlength"`
	PasswordStrength           *int    `json:"passwordStrength" gorm:"column:passwordstrength"`
	PasswordReset              *bool   `json:"passwordReset" gorm:"column:passwordreset"`
	IdleLogout                 *int    `json:"idleLogout" gorm:"column:idlelogout"`
}

// GetConsoleSettings returns the singleton settings row for the Settings screen.
func (h *WindowsHandler) GetConsoleSettings(c *gin.Context) {
	var settings consoleSettings
	if err := db.DB.Table("settings").Order("id ASC").Limit(1).Take(&settings).Error; err != nil {
		log.Printf("[console-settings] read failed: %v", err)
		c.JSON(http.StatusOK, consoleSettings{ID: 1})
		return
	}

	c.JSON(http.StatusOK, settings)
}
