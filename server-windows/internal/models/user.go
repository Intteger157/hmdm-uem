package models

// User maps the console user table owned by the legacy Java server. Go reads it
// for authentication and serves console administration when the SPA cannot
// reach the Java API (for example after Microsoft SSO).
type User struct {
	ID                  uint    `gorm:"primaryKey;column:id" json:"id"`
	Login               string  `gorm:"column:login" json:"login"`
	Name                *string `gorm:"column:name" json:"name,omitempty"`
	Email               *string `gorm:"column:email" json:"email,omitempty"`
	Password            string  `gorm:"column:password" json:"-"`
	CustomerID          int     `gorm:"column:customerid" json:"customerId"`
	UserRoleID          *uint   `gorm:"column:userroleid" json:"userRoleId,omitempty"`
	AllDevicesAvailable bool    `gorm:"column:alldevicesavailable" json:"allDevicesAvailable"`
	AllConfigAvailable  bool    `gorm:"column:allconfigavailable" json:"allConfigAvailable"`
	AuthToken           *string `gorm:"column:authtoken" json:"-"`
}

// TableName pins the model to the Java-owned `users` table.
func (User) TableName() string {
	return "users"
}
