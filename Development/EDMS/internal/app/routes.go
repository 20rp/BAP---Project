package app

import (
	"fmt"
	"net/http"
	"os"

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

		if role != "admin" {
			return c.Render(http.StatusForbidden, "dashboard.html", map[string]interface{}{
				"error": "You do not have permission to access this page/action",
			})
		}
		return next(c)
	}
}

func (a *App) initRoutes() {
	// Public routes
	a.Router.GET("/", a.HandleGetLogin)
	a.Router.GET("/register", a.HandleGetRegister)
	a.Router.POST("/register", a.HandlePostRegister)
	a.Router.GET("/forgot-password", a.HandleGetForgotPassword)
	a.Router.POST("/forgot-password", a.HandlePostForgotPassword)
	a.Router.POST("/login", a.HandlePostLogin)
	a.Router.GET("/logout", a.HandleGetLogout)

	// JWT middleware
	jwtMiddleware := echojwt.WithConfig(echojwt.Config{
		SigningKey:  []byte(os.Getenv("JWT_SECRET")),
		TokenLookup: "cookie:token",
		SuccessHandler: func(c echo.Context) {
			user := c.Get("user").(*jwt.Token)
			claims := user.Claims.(jwt.MapClaims)
			fmt.Println("User Name: ", claims["username"], "User ID: ", claims["user_id"], "User Role: ", claims["role"])
		},
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
	admin.GET("/api/user", a.HandleGetAllUsers)
	// Add any other admin-only routes as needed
	// User management routes - Alex
	//admin.POST("/api/user", a.HandlePostUser)
	//admin.PUT("/api/user/:id", a.HandlePutUser)
	//admin.DELETE("/api/user/:id", a.HandleDeleteUser)
	// Site management routes - Alex
	//admin.POST("/api/site", a.HandlePostSite)
	//admin.PUT("/api/site/:id", a.HandlePutSite)
	//admin.DELETE("/api/site/:id", a.HandleDeleteSite)
	// Building management routes - Joe
	//admin.POST("/api/building", a.HandlePostBuilding)
	//admin.PUT("/api/building/:id", a.HandlePutBuilding)
	//admin.DELETE("/api/building/:id", a.HandleDeleteBuilding)
	// Room management routes
	//admin.POST("/api/room", a.HandlePostRoom)
	//admin.PUT("/api/room/:id", a.HandlePutRoom)
	//admin.DELETE("/api/room/:id", a.HandleDeleteRoom)
	// Device type management routes - James
	//admin.POST("/api/emergency-device-type", a.HandlePostDeviceType)
	//admin.PUT("/api/emergency-device-type/:id", a.HandlePutDeviceType)
	//admin.DELETE("/api/emergency-device-type/:id", a.HandleDeleteDeviceType)
	// Device management routes - Liam
	//admin.POST("/api/emergency-device", a.HandlePostDevice)
	//admin.PUT("/api/emergency-device/:id", a.HandlePutDevice)
	//admin.DELETE("/api/emergency-device/:id", a.HandleDeleteDevice)

	// Other protected API routes
	api := protected.Group("/api")
	api.GET("/emergency-device", a.HandleGetAllDevices)
	api.GET("/emergency-device-type", a.HandleGetAllDeviceTypes)
	api.GET("/extinguisher-type", a.HandleGetAllExtinguisherTypes)
	api.GET("/room", a.HandleGetAllRooms)
	api.GET("/building", a.HandleGetAllBuildings)
	api.GET("/site", a.HandleGetAllSites)

	// Add any other routes as needed
}
