package models

// User maps the console user table owned by the legacy Java server. Go treats
// it as read-only: the admin JWT middleware resolves the caller's login to a
// role, and never migrates or writes this table.
type User struct {
	ID         uint    `gorm:"primaryKey;column:id" json:"id"`
	Login      string  `gorm:"column:login" json:"login"`
	Name       *string `gorm:"column:name" json:"name,omitempty"`
	Email      *string `gorm:"column:email" json:"email,omitempty"`
	UserRoleID *uint   `gorm:"column:userroleid" json:"userRoleId,omitempty"`
	AuthToken  *string `gorm:"column:authtoken" json:"-"`
}

// TableName pins the model to the Java-owned `users` table.
func (User) TableName() string {
	return "users"
}
