package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/AlexGithub777/BAP---Project/Development/EDMS/internal/config"
	"github.com/AlexGithub777/BAP---Project/Development/EDMS/internal/models"
	_ "github.com/lib/pq" // Import the PostgreSQL driver
	"golang.org/x/crypto/bcrypt"
)

func createTriggerAndFunctionIfNotExists(db *sql.DB) error {
	triggerName := "trg_update_device_status"                   // Trigger name
	triggerFunctionName := "update_device_status_on_inspection" // Function name

	// Check if the trigger function exists
	functionExistsQuery := `
		SELECT EXISTS (
			SELECT 1
			FROM pg_proc
			WHERE proname = $1
		)
	`

	var functionExists bool
	err := db.QueryRow(functionExistsQuery, triggerFunctionName).Scan(&functionExists)
	if err != nil {
		return err
	}

	// Create the trigger function if it does not exist
	if !functionExists {
		createFunctionSQL := `
		CREATE OR REPLACE FUNCTION update_device_status_on_inspection() 
		RETURNS TRIGGER AS $$
		DECLARE
			current_last_inspection_date DATE;
		BEGIN
			-- Retrieve the current last inspection date for the device
			SELECT LastInspectionDate INTO current_last_inspection_date
			FROM Emergency_DeviceT
			WHERE EmergencyDeviceID = NEW.EmergencyDeviceID;
		
			-- Check if the new inspection date is more recent than the current last inspection date
			IF current_last_inspection_date IS NULL OR NEW.InspectionDate > current_last_inspection_date THEN
				-- Update the last inspection date and status in Emergency_DeviceT
				UPDATE Emergency_DeviceT
				SET 
					LastInspectionDate = NEW.InspectionDate,
					Status = CASE 
								WHEN NEW.InspectionStatus = 'Failed' THEN 'Inspection Failed'
								WHEN NEW.InspectionStatus = 'Passed' THEN 'Active'
								ELSE Status
							 END
				WHERE EmergencyDeviceID = NEW.EmergencyDeviceID;
		
				RAISE NOTICE 'Device % status updated. Last inspection date set to %.', 
					NEW.EmergencyDeviceID, NEW.InspectionDate;
			ELSE
				RAISE NOTICE 'New inspection date % is not more recent than the current last inspection date % for device %. No update performed.', 
					NEW.InspectionDate, current_last_inspection_date, NEW.EmergencyDeviceID;
			END IF;
		
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
		`
		_, err = db.Exec(createFunctionSQL)
		if err != nil {
			return err
		}
		log.Println("Trigger function created:", triggerFunctionName)
	} else {
		log.Println("Trigger function already exists:", triggerFunctionName)
	}

	// Check if the trigger exists
	triggerExistsQuery := `
		SELECT EXISTS (
			SELECT 1
			FROM pg_trigger
			WHERE tgname = $1
		)
	`

	var triggerExists bool
	err = db.QueryRow(triggerExistsQuery, triggerName).Scan(&triggerExists)
	if err != nil {
		return err
	}

	// Create the trigger if it does not exist
	if !triggerExists {
		createTriggerSQL := `
			CREATE TRIGGER trg_update_device_status
			AFTER INSERT ON Emergency_Device_InspectionT
			FOR EACH ROW
			EXECUTE FUNCTION update_device_status_on_inspection();
		`
		_, err = db.Exec(createTriggerSQL)
		if err != nil {
			return err
		}
		log.Println("Trigger created:", triggerName)
	} else {
		log.Println("Trigger already exists:", triggerName)
	}

	return nil
}

func SeedData(db *sql.DB) {
	// Get admin password from .env
	adminPassword := config.LoadConfig().AdminPassword

	if adminPassword == "" {
		log.Fatal("ADMIN_PASSWORD not set in .env file")
	}

	userPassword := "Password1!"

	var siteID, hastingsSiteID, buildingIDA, buildingIDB, hastingsBuildingID int
	var roomA1ID, roomB1ID, hastingsMainRoomID int
	var co2TypeID, waterTypeID, dryTypeID int
	var emergencyDeviceTypeID int

	// Generate hash for password
	adminHash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("Error generating hash for admin password")
		log.Fatal(err)
	}

	userHash, err := bcrypt.GenerateFromPassword([]byte(userPassword), bcrypt.DefaultCost)

	if err != nil {
		fmt.Println("Error generating hash for user password")
		log.Fatal(err)
	}

	log.Println("Seeding data...")

	// Insert Users
	_, err = db.Exec(`
		INSERT INTO UserT (username, password, role, email, defaultadmin)
		VALUES ('admin1', $1, 'Admin', 'admin@email.com', true)`, adminHash)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`
		INSERT INTO UserT (username, password, role, email)
		VALUES ('user12', $1, 'User', 'user@email.com')`, userHash)
	if err != nil {
		log.Fatal(err)
	}

	// Insert Sites
	err = db.QueryRow(`
		INSERT INTO SiteT (SiteName, SiteAddress)
		VALUES ('EIT Taradale', '501 Gloucester Street, Taradale, Napier 4112') RETURNING SiteID`).Scan(&siteID)
	if err != nil {
		log.Fatal(err)
	}

	err = db.QueryRow(`
			INSERT INTO SiteT (SiteName, SiteAddress, SiteMapImagePath)
			VALUES ('EIT Hastings', '416 Heretaunga Street West, Hastings 4122', '/static/site_maps/EIT_Hastings.png') RETURNING SiteID`).Scan(&hastingsSiteID)
	if err != nil {
		log.Fatal(err)
	}

	// Insert Buildings
	err = db.QueryRow(`
			INSERT INTO BuildingT (SiteID, BuildingCode)
			VALUES ($1, 'A') RETURNING BuildingID`, siteID).Scan(&buildingIDA)
	if err != nil {
		log.Fatal(err)
	}
	err = db.QueryRow(`
			INSERT INTO BuildingT (SiteID, BuildingCode)
			VALUES ($1, 'B') RETURNING BuildingID`, siteID).Scan(&buildingIDB)
	if err != nil {
		log.Fatal(err)
	}
	err = db.QueryRow(`
			INSERT INTO BuildingT (SiteID, BuildingCode)
			VALUES ($1, 'Main') RETURNING BuildingID`, hastingsSiteID).Scan(&hastingsBuildingID)
	if err != nil {
		log.Fatal(err)
	}

	// Insert Rooms
	err = db.QueryRow(`
			INSERT INTO RoomT (BuildingID, RoomCode)
			VALUES ($1, 'A1') RETURNING RoomID`, buildingIDA).Scan(&roomA1ID)
	if err != nil {
		log.Fatal(err)
	}
	err = db.QueryRow(`
			INSERT INTO RoomT (BuildingID, RoomCode)
			VALUES ($1, 'B1') RETURNING RoomID`, buildingIDB).Scan(&roomB1ID)
	if err != nil {
		log.Fatal(err)
	}
	err = db.QueryRow(`
			INSERT INTO RoomT (BuildingID, RoomCode)
			VALUES ($1, 'Main Room') RETURNING RoomID`, hastingsBuildingID).Scan(&hastingsMainRoomID)
	if err != nil {
		log.Fatal(err)
	}

	// Insert Extinguisher Types
	err = db.QueryRow(`
			INSERT INTO Extinguisher_TypeT (ExtinguisherTypeName)
			VALUES ('CO2') RETURNING ExtinguisherTypeID`).Scan(&co2TypeID)
	if err != nil {
		log.Fatal(err)
	}
	err = db.QueryRow(`
			INSERT INTO Extinguisher_TypeT (ExtinguisherTypeName)
			VALUES ('Water') RETURNING ExtinguisherTypeID`).Scan(&waterTypeID)
	if err != nil {
		log.Fatal(err)
	}
	err = db.QueryRow(`
			INSERT INTO Extinguisher_TypeT (ExtinguisherTypeName)
			VALUES ('Dry') RETURNING ExtinguisherTypeID`).Scan(&dryTypeID)
	if err != nil {
		log.Fatal(err)
	}

	// Insert Emergency Device Type
	err = db.QueryRow(`
			INSERT INTO Emergency_Device_TypeT (EmergencyDeviceTypeName)
			VALUES ('Fire Extinguisher') RETURNING EmergencyDeviceTypeID`).Scan(&emergencyDeviceTypeID)
	if err != nil {
		log.Fatal(err)
	}

	// Create Emergency Devices using the models.EmergencyDevice struct
	devices := []models.EmergencyDevice{
		{
			EmergencyDeviceTypeName: "Fire Extinguisher",
			ExtinguisherTypeName:    sql.NullString{Valid: true, String: "CO2"},
			RoomCode:                "A1",
			SerialNumber:            sql.NullString{Valid: true, String: "SN00001"},
			ManufactureDate:         sql.NullTime{Valid: true, Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
			LastInspectionDate:      sql.NullTime{Valid: true, Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
			Description:             sql.NullString{Valid: true, String: "Test Fire Extinguisher 1"},
			Size:                    sql.NullString{Valid: true, String: "5kg"},
			Status:                  sql.NullString{Valid: true, String: "Active"},
		},
		{
			EmergencyDeviceTypeName: "Fire Extinguisher",
			ExtinguisherTypeName:    sql.NullString{Valid: true, String: "Water"},
			RoomCode:                "B1",
			SerialNumber:            sql.NullString{Valid: true, String: "SN00002"},
			ManufactureDate:         sql.NullTime{Valid: true, Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
			LastInspectionDate:      sql.NullTime{Valid: true, Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
			Description:             sql.NullString{Valid: true, String: "Test Fire Extinguisher 2"},
			Size:                    sql.NullString{Valid: true, String: "5kg"},
			Status:                  sql.NullString{Valid: true, String: "Inspection Failed"},
		},
		{
			EmergencyDeviceTypeName: "Fire Extinguisher",
			ExtinguisherTypeName:    sql.NullString{Valid: true, String: "Dry"},
			RoomCode:                "A1",
			SerialNumber:            sql.NullString{Valid: true, String: "SN00003"},
			ManufactureDate:         sql.NullTime{Valid: true, Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
			LastInspectionDate:      sql.NullTime{Valid: false},
			Description:             sql.NullString{Valid: true, String: "Test Fire Extinguisher 3"},
			Size:                    sql.NullString{Valid: true, String: "5kg"},
			Status:                  sql.NullString{Valid: true, String: "Inactive"},
		},
		{
			EmergencyDeviceTypeName: "Fire Extinguisher",
			ExtinguisherTypeName:    sql.NullString{Valid: true, String: "CO2"},
			RoomCode:                "Main Room",
			SerialNumber:            sql.NullString{Valid: true, String: "SN00004"},
			ManufactureDate:         sql.NullTime{Valid: true, Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
			LastInspectionDate:      sql.NullTime{Valid: true, Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
			Description:             sql.NullString{Valid: true, String: "Hastings Main Room Fire Extinguisher"},
			Size:                    sql.NullString{Valid: true, String: "5kg"},
			Status:                  sql.NullString{Valid: true, String: "Active"},
		},
	}

	// Insert Emergency Devices into the database
	for _, device := range devices {
		var roomID int
		var extinguisherTypeID int

		// Map RoomCode to RoomID
		switch device.RoomCode {
		case "A1":
			roomID = roomA1ID
		case "B1":
			roomID = roomB1ID
		case "Main Room":
			roomID = hastingsMainRoomID
		}

		// Map ExtinguisherTypeName to ExtinguisherTypeID
		switch device.ExtinguisherTypeName.String {
		case "CO2":
			extinguisherTypeID = co2TypeID
		case "Water":
			extinguisherTypeID = waterTypeID
		case "Dry":
			extinguisherTypeID = dryTypeID
		}

		_, err := db.Exec(`
				INSERT INTO Emergency_DeviceT
					(EmergencyDeviceTypeID, RoomID, ExtinguisherTypeID, SerialNumber, ManufactureDate, LastInspectionDate, Description, Size, Status)
				VALUES
					($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			emergencyDeviceTypeID, roomID, extinguisherTypeID,
			device.SerialNumber, device.ManufactureDate, device.LastInspectionDate, device.Description, device.Size, device.Status,
		)
		if err != nil {
			log.Fatal(err)
		}
	}

	// Insert Inspections
	_, err = db.Exec(`
		INSERT INTO Emergency_Device_InspectionT
			(EmergencyDeviceID, UserID, InspectionDate, CreatedAt, IsConspicuous, IsAccessible, IsAssignedLocation, IsSignVisible, IsAntiTamperDeviceIntact, IsSupportBracketSecure, AreOperatingInstructionsClear, IsMaintenanceTagAttached, IsNoExternalDamage, IsReplaced, AreMaintenanceRecordsComplete, WorkOrderRequired, InspectionStatus, Notes)
		VALUES
			(1, 1, '2024-01-01', '2024-01-01', true, true, true, true, true, true, true, true, true, true, true, true, 'Passed', 'No notes')`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`
		INSERT INTO Emergency_Device_InspectionT
			(EmergencyDeviceID, UserID, InspectionDate, CreatedAt, IsConspicuous, IsAccessible, IsAssignedLocation, IsSignVisible, IsAntiTamperDeviceIntact, IsSupportBracketSecure, AreOperatingInstructionsClear, IsMaintenanceTagAttached, IsNoExternalDamage, IsReplaced, AreMaintenanceRecordsComplete, WorkOrderRequired, InspectionStatus, Notes)
		VALUES
			(2, 1, '2024-01-01', '2024-01-01', true, true, true, true, true, true, true, true, true, true, true, true, 'Failed', 'No notes')`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`
	INSERT INTO Emergency_Device_InspectionT
		(EmergencyDeviceID, UserID, InspectionDate, CreatedAt, IsConspicuous, IsAccessible, IsAssignedLocation, IsSignVisible, IsAntiTamperDeviceIntact, IsSupportBracketSecure, AreOperatingInstructionsClear, IsMaintenanceTagAttached, IsNoExternalDamage, IsReplaced, AreMaintenanceRecordsComplete, WorkOrderRequired, InspectionStatus, Notes)
	VALUES
		(3, 1, '2024-01-01', '2024-01-01', true, NULL, true, NULL, true, NULL, NULL, true, true, NULL, true, true, 'Failed', 'No notes')`)
	if err != nil {
		log.Fatal(err)
	}

	// Create a temp file in .internal/ directory
	tempFile, err := os.Create("internal/seed_complete")
	if err != nil {
		log.Fatal(err)
	}
	tempFile.Close()

	// Create trigger and function if they don't exist
	err = createTriggerAndFunctionIfNotExists(db)
	if err != nil {
		log.Fatalf("Failed to create trigger or function: %v", err)
	}

	log.Println("Seeding complete.")
}
