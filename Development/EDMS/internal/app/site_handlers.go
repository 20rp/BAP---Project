package app

import (
	"database/sql"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/AlexGithub777/BAP---Project/Development/EDMS/internal/models"
	"github.com/labstack/echo/v4"
)

func (a *App) HandlePostSite(c echo.Context) error {
	// Check if request if a GET request
	if c.Request().Method != http.MethodPost {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Method not allowed")
	}

	// Parse the form, limiting upload size to 10MB
	err := c.Request().ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Error parsing form")
	}

	// Get the form values
	siteName := strings.TrimSpace(c.FormValue("addSiteName"))       // Trim whitespace
	siteAddress := strings.TrimSpace(c.FormValue("addSiteAddress")) // Trim whitespace

	// Validate input
	if siteName == "" || siteAddress == "" {
		return c.Redirect(http.StatusSeeOther, "/admin?error=All fields are required")
	}

	// Validate site name & address length (site name should be less than 100 characters) (address should be less than 255 characters)
	if len(siteName) > 100 || len(siteAddress) > 255 {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Site name should be less than 100 characters and address should be less than 255 characters")
	}

	// Additional validation for siteName (allow only alphanumeric, spaces, hyphens, and underscores)
	if !regexp.MustCompile(`^[a-zA-Z0-9\s_-]+$`).MatchString(siteName) {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Site name can only contain letters, numbers, spaces, hyphens, and underscores")
	}

	// Check if site name is unique
	_, err = a.DB.GetSiteByName(siteName)
	if err == nil {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Site name already exists")
	} else if err != sql.ErrNoRows { // If the error is not sql.ErrNoRows, it's a database error
		return c.Redirect(http.StatusSeeOther, "/admin?error=Database error")
	}

	// Initialize filePath as an empty sql.NullString
	filePath := sql.NullString{String: "", Valid: false}

	// Retrieve the file from the form
	file, header, err := c.Request().FormFile("siteMapImgInput")
	if err == nil {
		defer file.Close()
		// Validate file extension
		// Create unique file name based on the site name
		fileExt := filepath.Ext(header.Filename)
		allowedExtensions := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".svg": true}
		if !allowedExtensions[fileExt] {
			return c.Redirect(http.StatusSeeOther, "/admin?error=Invalid file type. Allowed types: jpg, jpeg, png, gif, svg")
		}
		// Define static directory for site maps
		staticDir := "./static/site_maps"
		if _, err := os.Stat(staticDir); os.IsNotExist(err) {
			os.MkdirAll(staticDir, os.ModePerm) // Create directory if it doesn't exist
		}

		sanitizedSiteName := strings.ReplaceAll(siteName, " ", "_")
		sanitizedSiteName = regexp.MustCompile(`[^a-zA-Z0-9_-]`).ReplaceAllString(sanitizedSiteName, "")
		fileName := filepath.Join(staticDir, sanitizedSiteName+fileExt)

		out, err := os.Create(fileName)
		if err != nil {
			return c.Redirect(http.StatusInternalServerError, "/admin?error=Error creating file")
		}
		defer out.Close()

		// Copy the uploaded file data to the new file
		_, err = io.Copy(out, file)
		if err != nil {
			return c.Redirect(http.StatusInternalServerError, "/admin?error=Error copying file")
		}

		// Save the relative path as a sql.NullString
		filePath = sql.NullString{String: "/static/site_maps/" + sanitizedSiteName + fileExt, Valid: true}
	}

	// Save site information and file path in the database
	site := &models.Site{
		SiteName:         siteName,
		SiteAddress:      siteAddress,
		SiteMapImagePath: filePath,
	}

	err = a.DB.AddSite(site)
	if err != nil {
		return a.handleError(c, http.StatusInternalServerError, "Error saving site", err)
	}

	// Redirect to the admin page with a success message
	return c.Redirect(http.StatusFound, "/admin?message=Site added successfully")
}

func (a *App) HandleEditSite(c echo.Context) error {
	// Check if request if a GET request
	if c.Request().Method != http.MethodPost {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Method not allowed")
	}

	// Parse the form, limiting upload size to 10MB
	err := c.Request().ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Error parsing form")
	}

	// Get the form values
	siteID := c.FormValue("editSiteID")
	siteName := strings.TrimSpace(c.FormValue("editSiteName"))       // Trim whitespace
	siteAddress := strings.TrimSpace(c.FormValue("editSiteAddress")) // Trim whitespace

	// Validate input
	if siteName == "" || siteAddress == "" {
		return c.Redirect(http.StatusSeeOther, "/admin?error=All fields are required")
	}

	// Validate site name & address length (site name should be less than 100 characters) (address should be less than 255 characters)
	if len(siteName) > 100 || len(siteAddress) > 255 {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Site name should be less than 100 characters and address should be less than 255 characters")
	}

	// Additional validation for siteName (allow only alphanumeric, spaces, hyphens, and underscores)
	if !regexp.MustCompile(`^[a-zA-Z0-9\s_-]+$`).MatchString(siteName) {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Site name can only contain letters, numbers, spaces, hyphens, and underscores")
	}

	// Get the existing site by ID
	existingSite, err := a.DB.GetSiteByID(siteID)
	if err != nil {
		return a.handleError(c, http.StatusInternalServerError, "Error fetching site", err)
	}

	// Check if updated site name is unique
	siteWithSameName, err := a.DB.GetSiteByName(siteName)
	if err != nil {
		if err != sql.ErrNoRows { // If the error is not sql.ErrNoRows, it's a database error
			return a.handleError(c, http.StatusInternalServerError, "Database error", err)
		}
	} else if siteWithSameName.SiteID != existingSite.SiteID {
		return c.Redirect(http.StatusSeeOther, "/admin?error=Site name already exists")
	}

	// Initialize filePath as an empty sql.NullString
	filePath := sql.NullString{String: "", Valid: false}

	// Define static directory for site maps
	staticDir := "./static/site_maps"

	// Create sanitized site name
	sanitizedSiteName := strings.ReplaceAll(siteName, " ", "_")
	sanitizedSiteName = regexp.MustCompile(`[^a-zA-Z0-9_-]`).ReplaceAllString(sanitizedSiteName, "")

	// Initialize file extension
	var fileExt string

	// Retrieve the file from the form
	file, header, err := c.Request().FormFile("siteMapImgInput")
	if err == nil {
		defer file.Close()

		// If a new image is being uploaded and the existing site has an image, delete the old image
		if existingSite != nil && existingSite.SiteMapImagePath.Valid {
			oldImagePath := "." + existingSite.SiteMapImagePath.String
			if err := os.Remove(oldImagePath); err != nil {
				return c.Redirect(http.StatusInternalServerError, "/admin?error=Error deleting old image")
			}
		}

		// Validate file extension
		// Create unique file name based on the site name
		fileExt = filepath.Ext(header.Filename)
		allowedExtensions := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".svg": true}
		if !allowedExtensions[fileExt] {
			return c.Redirect(http.StatusSeeOther, "/admin?error=Invalid file type. Allowed types: jpg, jpeg, png, gif, svg")
		}

		// Define static directory for site maps
		if _, err := os.Stat(staticDir); os.IsNotExist(err) {
			os.MkdirAll(staticDir, os.ModePerm) // Create directory if it doesn't exist
		}

		sanitizedSiteName = strings.ReplaceAll(siteName, " ", "_")
		sanitizedSiteName = regexp.MustCompile(`[^a-zA-Z0-9_-]`).ReplaceAllString(sanitizedSiteName, "")
		fileName := filepath.Join(staticDir, sanitizedSiteName+fileExt)

		out, err := os.Create(fileName)
		if err != nil {
			return c.Redirect(http.StatusInternalServerError, "/admin?error=Error creating file")
		}
		defer out.Close()

		// Copy the uploaded file data to the new file
		_, err = io.Copy(out, file)
		if err != nil {
			return c.Redirect(http.StatusInternalServerError, "/admin?error=Error copying file")
		}

		// Save the relative path as a sql.NullString
		filePath = sql.NullString{String: "/static/site_maps/" + sanitizedSiteName + fileExt, Valid: true}
	} else {
		fileExt = filepath.Ext(existingSite.SiteMapImagePath.String)
	}

	// check if the site name has changed and a map exists
	if siteName != existingSite.SiteName && existingSite.SiteMapImagePath.Valid {
		// Only rename the file if no new file is uploaded
		if err != nil {
			oldImagePath := "." + existingSite.SiteMapImagePath.String
			newImagePath := filepath.Join(staticDir, sanitizedSiteName+fileExt)
			if err := os.Rename(oldImagePath, newImagePath); err != nil {
				return c.Redirect(http.StatusInternalServerError, "/admin?error=Error renaming image")
			}

			// Update the file path
			filePath = sql.NullString{String: "/static/site_maps/" + sanitizedSiteName + fileExt, Valid: true}
		}
	}

	// Save site information and file path in the database
	var siteMapImagePath sql.NullString
	if filePath.Valid {
		siteMapImagePath = filePath
	} else {
		siteMapImagePath = existingSite.SiteMapImagePath
	}

	site := &models.Site{
		SiteID:           existingSite.SiteID,
		SiteName:         siteName,
		SiteAddress:      siteAddress,
		SiteMapImagePath: siteMapImagePath, // Use the existing path if no new file was uploaded
	}

	err = a.DB.UpdateSite(site)
	if err != nil {
		return a.handleError(c, http.StatusInternalServerError, "Error saving site", err)
	}

	// Respond to the client
	return c.Redirect(http.StatusFound, "/admin?message=Site updated successfully")
}

func (a *App) HandleDeleteSite(c echo.Context) error {
	// Check if request is not a delete request
	if c.Request().Method != http.MethodDelete {
		return c.JSON(http.StatusMethodNotAllowed, map[string]string{
			"error":       "Method not allowed",
			"redirectURL": "/admin?error=Method not allowed",
		})
	}

	// Get the site ID from the URL
	siteID := c.Param("id")

	// Get the site by ID
	site, err := a.DB.GetSiteByID(siteID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error":       "Error fetching site",
			"redirectURL": "/admin?error=Error fetching site",
		})
	}

	// Check if the site has any emergency devices
	emergencyDevices, err := a.DB.GetAllDevices(siteID, "")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error":       "Error fetching emergency devices",
			"redirectURL": "/admin?error=Error fetching emergency devices",
		})
	}

	// Check if the site has any emergency devices
	if len(emergencyDevices) > 0 {
		return c.JSON(http.StatusOK, map[string]string{
			"error":       "Cannot delete site with associated emergency devices",
			"redirectURL": "/admin?error=Cannot delete site with associated emergency devices",
		})
	}

	// Check if the site has any rooms
	rooms, err := a.DB.GetRoomsBySiteID(siteID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error":       "Error fetching rooms",
			"redirectURL": "/admin?error=Error fetching rooms",
		})
	}

	// Check if the site has any rooms
	if len(rooms) > 0 {
		return c.JSON(http.StatusOK, map[string]string{
			"error":       "Cannot delete site with associated rooms",
			"redirectURL": "/admin?error=Cannot delete site with associated rooms",
		})
	}

	// Handle foreign key constraints
	// Check if the site has any buildings
	buildings, err := a.DB.GetAllBuildings(siteID)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error":       "Error fetching buildings",
			"redirectURL": "/admin?error=Error fetching buildings",
		})
	}

	if len(buildings) > 0 {
		return c.JSON(http.StatusOK, map[string]string{
			"error":       "Cannot delete site with associated buildings",
			"redirectURL": "/admin?error=Cannot delete site with associated buildings",
		})
	}

	// Delete the site from the database
	err = a.DB.DeleteSite(siteID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error":       "Error deleting site",
			"redirectURL": "/admin?error=Error deleting site",
		})
	}

	// Check if the site has a map image
	if site.SiteMapImagePath.Valid {
		// Delete the map image file
		imagePath := "." + site.SiteMapImagePath.String
		if err := os.Remove(imagePath); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error":       "Error deleting site map image",
				"redirectURL": "/admin?error=Error deleting site map image",
			})

		}
	}

	// Respond to the client
	return c.JSON(http.StatusOK, map[string]string{
		"message":     "Site deleted successfully",
		"redirectURL": "/admin?message=Site deleted successfully",
	})
}

func (a *App) HandleGetAllSites(c echo.Context) error {
	// Check if request if a POST request
	if c.Request().Method != http.MethodGet {
		return c.Redirect(http.StatusSeeOther, "/dashboard?error=Method not allowed")
	}

	sites, err := a.DB.GetAllSites()
	if err != nil {
		return a.handleError(c, http.StatusInternalServerError, "Error fetching data", err)
	}

	// Return the results as JSON
	return c.JSON(http.StatusOK, sites)
}

func (a *App) HamdleGetSiteByID(c echo.Context) error {
	// Check if request if a POST request
	if c.Request().Method != http.MethodGet {
		return c.Redirect(http.StatusSeeOther, "/dashboard?error=Method not allowed")
	}

	id := c.Param("id")
	site, err := a.DB.GetSiteByID(id)
	if err != nil {
		return a.handleError(c, http.StatusInternalServerError, "Error fetching data", err)
	}

	// Return the results as JSON
	return c.JSON(http.StatusOK, site)
}
