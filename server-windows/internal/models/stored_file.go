package models

import "time"

// StoredFile is one uploaded file in the Windows file repository.
type StoredFile struct {
	ID           uint      `gorm:"primaryKey"`
	Filename     string    `gorm:"not null;uniqueIndex"`
	OriginalName string    `gorm:"not null"`
	SizeBytes    int64     `gorm:"not null"`
	SHA256       string    `gorm:"index;not null"`
	UploadDate   time.Time `gorm:"not null"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (StoredFile) TableName() string {
	return "files"
}

// StoredFileJSON is one file entry for the admin UI.
type StoredFileJSON struct {
	ID           uint      `json:"id"`
	Filename     string    `json:"filename"`
	OriginalName string    `json:"originalName"`
	SizeBytes    int64     `json:"sizeBytes"`
	SHA256       string    `json:"sha256"`
	UploadDate   time.Time `json:"uploadDate"`
	DownloadURL  string    `json:"downloadUrl"`
}

// StoredFileListResponse is returned by GET /files.
type StoredFileListResponse struct {
	Items           []StoredFileJSON `json:"items"`
	TotalItemsCount int64            `json:"totalItemsCount"`
}
