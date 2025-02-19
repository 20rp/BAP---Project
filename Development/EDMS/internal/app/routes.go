package app

import (
	"net/http"

	"github.com/AlexGithub777/BAP---Project/Development/EDMS/internal/config"
	"github.com/golang-jwt/jwt/v5"
	echojwt "github.com/labstack/echo-jwt/v4"
	"github.com/labstack/echo/v4"
)

// AdminOnly middleware
func (a *App) AdminOnly(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		user := c.Get("user").(*jwt.Token)
		claims := user.Claims.(jwt.MapClaims)
		role := claims["role"]

		if role != "Admin" {
			return c.Redirect(http.StatusSeeOther, "/dashboard?error=You%20do%20not%20have%20permission%20to%20access%20this%20page")
		}
		return next(c)
	}
}

func (a *App) initRoutes() {
	secret := config.LoadConfig().JWTSecret
	// Public routes
	a.Router.GET("/", a.HandleGetLogin)
	a.Router.GET("/login", a.HandleGetLogin)
	a.Router.GET("/register", a.HandleGetRegister)
	a.Router.POST("/register", a.HandlePostRegister)
	a.Router.GET("/forgot-password", a.HandleGetForgotPassword)
	a.Router.POST("/forgot-password", a.HandlePostForgotPassword)
	a.Router.POST("/login", a.HandlePostLogin)
	a.Router.GET("/logout", a.HandleGetLogout)

	// JWT middleware
	jwtMiddleware := echojwt.WithConfig(echojwt.Config{
		SigningKey:  []byte(secret),
		TokenLookup: "cookie:token",
		ErrorHandler: func(c echo.Context, err error) error {
			return c.Redirect(http.StatusSeeOther, "/")
		},
	})

	// Protected routes
	protected := a.Router.Group("")
	protected.Use(jwtMiddleware)

	protected.GET("/dashboard", a.HandleGetDashboard)

	// Admin-only routes
	admin := protected.Group("")
	admin.Use(a.AdminOnly)
	admin.GET("/admin", a.HandleGetAdmin)
	// Add any other admin-only routes as needed
	admin.PUT("/api/emergency-device/:id/status", a.HandlePutDeviceStatus)
	// Inspection management routes - Alex
	admin.GET("/api/inspection", a.HandleGetAllInspectionsByDeviceID)
	admin.GET("/api/inspection/:id", a.HandleGetInspectionByID)
	admin.POST("/api/inspection", a.HandlePostInspection)

	// User management routes - Alex
	admin.GET("/api/user", a.HandleGetAllUsers)
	admin.GET("/api/user/:username", a.HandleGetUserByUsername)
	admin.PUT("/api/user/:id", a.HandlePutUser)
	admin.DELETE("/api/user/:id", a.HandleDeleteUser)
	// Site management routes - Alex
	admin.POST("/api/site", a.HandlePostSite)
	admin.POST("/api/site/:id", a.HandleEditSite)
	admin.DELETE("/api/site/:id", a.HandleDeleteSite)
	// Building management routes - Joe
	admin.POST("/api/building", a.HandlePostBuilding)
	admin.PUT("/api/building/:id", a.HandleEditBuilding)
	admin.DELETE("/api/building/:id", a.HandleDeleteBuilding)
	// Room management routes
	admin.POST("/api/room", a.HandlePostRoom)
	admin.PUT("/api/room/:id", a.HandlePutRoom)
	admin.DELETE("/api/room/:id", a.HandleDeleteRoom)
	// Device type management routes - James
	admin.POST("/api/emergency-device-type", a.HandlePostDeviceType)
	admin.GET("/api/emergency-device-type/:id", a.HandleGetAllDeviceTypeByID)
	admin.PUT("/api/emergency-device-type/:id", a.HandlePutDeviceType)
	admin.DELETE("/api/emergency-device-type/:id", a.HandleDeleteDeviceType)
	// Device management routes - Liam
	admin.POST("/api/emergency-device", a.HandlePostDevice)
	admin.PUT("/api/emergency-device/:id", a.HandlePutDevice)
	admin.DELETE("/api/emergency-device/:id", a.HandleDeleteDevice)

	// Other protected API routes
	api := protected.Group("/api")
	api.GET("/emergency-device", a.HandleGetAllDevices)
	api.GET("/emergency-device/:id", a.HandleGetDeviceByID)
	api.GET("/emergency-device-type", a.HandleGetAllDeviceTypes)
	api.GET("/extinguisher-type", a.HandleGetAllExtinguisherTypes)
	api.GET("/room", a.HandleGetAllRooms)
	api.GET("/room/:id", a.HandleGetRoomByID)
	api.GET("/building", a.HandleGetAllBuildings)
	api.GET("/building/:id", a.HandleGetBuildingByID)
	api.GET("/site", a.HandleGetAllSites)
	api.GET("/site/:id", a.HamdleGetSiteByID)

	// Add any other routes as needed
}
