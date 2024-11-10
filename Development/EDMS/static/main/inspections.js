// inspections.js

function formatDate(dateString, options) {
    if (!dateString || dateString === "0001-01-01T00:00:00Z") {
        return "N/A";
    }
    return new Date(dateString).toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland", // Ensure the correct timezone
        ...options,
    });
}

export function initializeInspectionForm() {
    // Select form elements
    const addInspectionButton = document.querySelector("#addInspectionBtn");
    const addInspectionForm = document.querySelector("#addInspectionForm");
    const inspectionDateTimeInput = document.querySelector(
        "#InspectionDateTimeInput"
    );
    const inspectionStatus = document.querySelector("#inspectionStatus");
    const inspectionDateFeedback = document.getElementById(
        "inspectionDateFeedback"
    );
    const inspectionStatusFeedback = inspectionStatus?.nextElementSibling;

    if (
        !addInspectionButton ||
        !addInspectionForm ||
        !inspectionDateTimeInput ||
        !inspectionStatus
    ) {
        console.error("Required elements not found in the DOM.");
        return;
    }

    const checkboxes = Array.from(
        addInspectionForm.querySelectorAll('input[type="checkbox"]')
    ).filter(
        (checkbox) => !["workOrderRequired", "isReplaced"].includes(checkbox.id)
    );

    function validateInspectionStatus() {
        const allChecked = checkboxes.every((checkbox) => checkbox.checked);
        if (inspectionStatus.value === "Passed" && !allChecked) {
            inspectionStatus.setCustomValidity(
                "All inspection criteria must be met to mark as Passed"
            );
            inspectionStatusFeedback.textContent =
                "All inspection criteria must be met to mark as Passed";
            return false;
        } else if (!inspectionStatus.value) {
            inspectionStatus.setCustomValidity(
                "Please select an inspection status"
            );
            inspectionStatusFeedback.textContent =
                "Please select an inspection status";
            return false;
        } else {
            inspectionStatus.setCustomValidity("");
            inspectionStatusFeedback.textContent = "";
            return true;
        }
    }

    inspectionStatus.addEventListener("change", function () {
        validateInspectionStatus();
        if (addInspectionForm.classList.contains("was-validated")) {
            inspectionStatusFeedback.style.display = this.validationMessage
                ? "block"
                : "none";
            inspectionStatusFeedback.textContent = this.validationMessage || "";
        }
    });

    checkboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            if (inspectionStatus.value === "Passed") {
                validateInspectionStatus();
                if (addInspectionForm.classList.contains("was-validated")) {
                    inspectionStatusFeedback.style.display =
                        inspectionStatus.validationMessage ? "block" : "none";
                    inspectionStatusFeedback.textContent =
                        inspectionStatus.validationMessage;
                }
            }
        });
    });

    inspectionDateTimeInput.addEventListener("input", function () {
        const currentDateTime = new Date();
        const inputDateTime = new Date(inspectionDateTimeInput.value);
        if (inputDateTime) {
            if (inputDateTime > currentDateTime) {
                inspectionDateTimeInput.setCustomValidity(
                    "Inspection date and time cannot be in the future"
                );
                inspectionDateFeedback.textContent =
                    "Inspection date and time cannot be in the future";
            } else {
                inspectionDateTimeInput.setCustomValidity("");
                inspectionDateFeedback.textContent = "";
            }
        } else {
            inspectionDateTimeInput.setCustomValidity(
                "Please provide a valid inspection date and time"
            );
            inspectionDateFeedback.textContent =
                "Please provide a valid inspection date and time";
        }
    });

    // Add event listener to the form submit button
    addInspectionButton.addEventListener("click", async function (event) {
        event.preventDefault();
        if (inspectionDateTimeInput.value) {
            const currentDateTime = new Date();
            const inputDateTime = new Date(inspectionDateTimeInput.value);
            if (inputDateTime > currentDateTime) {
                inspectionDateTimeInput.setCustomValidity(
                    "Inspection date and time cannot be in the future"
                );
                inspectionDateFeedback.textContent =
                    "Inspection date and time cannot be in the future";
            } else {
                inspectionDateTimeInput.setCustomValidity("");
                inspectionDateFeedback.textContent = "";
            }
        } else {
            inspectionDateTimeInput.setCustomValidity(
                "Please provide an inspection date and time"
            );
            inspectionDateFeedback.textContent =
                "Please provide an inspection date and time";
        }

        validateInspectionStatus();
        addInspectionForm.classList.add("was-validated");

        if (!addInspectionForm.checkValidity()) {
            event.stopPropagation();
            if (inspectionStatus.validationMessage) {
                inspectionStatusFeedback.style.display = "block";
                inspectionStatusFeedback.textContent =
                    inspectionStatus.validationMessage;
            }
            if (inspectionDateTimeInput.validationMessage) {
                inspectionDateFeedback.style.display = "block";
                inspectionDateFeedback.textContent =
                    inspectionDateTimeInput.validationMessage;
            }
        } else {
            try {
                sessionStorage.setItem("shouldRefreshNotifications", "true");
                // Submit the form
                await addInspectionForm.submit();
            } catch (error) {
                console.error(
                    "Error submitting inspection or updating notifications:",
                    error
                );
            }
        }
    });
}

export function viewDeviceInspections(deviceId) {
    // Close the notification modal if open
    $("#notificationsModal").modal("hide");

    // Clear the inspection table
    document.getElementById("inspectionTable").innerHTML = "";

    // Clear the hidden input field
    document.getElementById("inspect_device_id").value = "";

    // Fetch the inspections for this device
    fetch(`/api/inspection?device_id=${deviceId}`)
        .then((response) => response.json())
        .then((data) => {
            const inspectionTable = document.getElementById("inspectionTable");

            if (!data || !Array.isArray(data) || data.length === 0) {
                inspectionTable.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center">No inspections found</td>
                    </tr>
                `;
            } else {
                inspectionTable.innerHTML = data
                    .map((inspection) => {
                        const formattedDate = inspection.inspection_datetime
                            .Valid
                            ? new Date(
                                  inspection.inspection_datetime.Time
                              ).toLocaleDateString("en-NZ", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                              })
                            : "No Date Available";

                        // Determine badge color based on inspection status
                        let badgeClass = "badge text-bg-primary"; // default color
                        if (inspection.inspection_status === "Passed") {
                            badgeClass = "badge text-bg-success";
                        } else if (inspection.inspection_status === "Failed") {
                            badgeClass = "badge text-bg-danger";
                        }

                        return `
                            <tr>
                                <td data-label="Inspection Date">${formattedDate}</td>
                                <td data-label="Inspector Name">${
                                    inspection.inspector_name || "Unknown"
                                }</td>
                                <td data-label="Inspection Status">
                                    <span class="badge ${badgeClass}">${
                            inspection.inspection_status || "Not Set"
                        }</span>
                                </td>
                                <td>
                                    <button class="btn btn-primary" onclick="viewInspectionDetails(${
                                        inspection.emergency_device_inspection_id
                                    })">View</button>
                                </td>
                            </tr>
                        `;
                    })
                    .join("");
            }

            if (data) {
                // Set the modal title with the device serial number
                document.getElementById("inspectionModalTitle").innerText =
                    `Extinguisher Inspections - Serial Number: ${data[0].serial_number}` ||
                    "Unknown";
                // Set the add inspection modal title with the device serial number
                document.getElementById("addInspectionModalTitle").innerText =
                    `Add Inspection - Serial Number: ${data[0].serial_number}` ||
                    "Add Inspection";
            } else {
                document.getElementById("inspectionModalTitle").innerText =
                    "Extinguisher Inspections";
            }
        })
        .catch((error) => {
            console.error("Error fetching inspection data:", error);
            document.getElementById("inspectionTable").innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">Failed to load inspections</td>
                </tr>
            `;
        });

    // Set the device ID in the hidden input field
    document.getElementById("inspect_device_id").value = deviceId;

    // Show the modal
    $("#viewInspectionModal").modal("show");
}

export function addInspection() {
    const deviceId = document.getElementById("inspect_device_id").value;

    // Set the user ID in the hidden input field
    document.getElementById("inspect_user_id").value = user_id;

    // Close the view inspection modal
    $("#viewInspectionModal").modal("hide");

    // Clear the form and reset validation classes
    const addInspectionForm = document.getElementById("addInspectionForm");
    addInspectionForm.reset();
    addInspectionForm.classList.remove("was-validated");

    // Clear the feedback messages
    const feedbackElements =
        addInspectionForm.querySelectorAll(".invalid-feedback");

    feedbackElements.forEach((element) => {
        element.textContent = "";
    });

    // Add the device ID to the hidden input field
    const deviceIdInput = document.getElementById("add_inspection_device_id");
    deviceIdInput.value = deviceId;

    // Show the add inspection modal
    $("#addInspectionModal").modal("show");
}

export function viewInspectionDetails(inspectionId) {
    $("#viewInspectionModal").modal("hide");

    fetch(`/api/inspection/${inspectionId}`)
        .then((response) => response.json())
        .then((data) => {
            document.getElementById("inspector_username").innerText =
                data.inspector_name || "Unknown";

            // Options for date and date-time formatting
            const dateOptions = {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Pacific/Auckland", // Ensure correct timezone here as well
            };

            const dateTimeOptions = {
                ...dateOptions,
                hour: "numeric",
                minute: "numeric",
                hour12: true,
                timeZone: "Pacific/Auckland",
            };

            // Format and display inspection date
            document.getElementById("ViewInspectionDateTimeInput").innerText =
                data.inspection_datetime.Valid
                    ? formatDate(data.inspection_datetime.Time, dateTimeOptions)
                    : "No Date Available";

            // Format and display created date
            document.getElementById("ViewInspectionCreatedAt").innerText = data
                .created_at.Valid
                ? formatDate(data.created_at.Time, dateTimeOptions)
                : "No Date Available";

            // Create badge for inspection status
            const statusBadge = document.createElement("span");
            statusBadge.className = "badge";

            switch (data.inspection_status) {
                case "Passed":
                    statusBadge.classList.add("bg-success");
                    statusBadge.innerText = "Passed";
                    break;
                case "Failed":
                    statusBadge.classList.add("bg-danger");
                    statusBadge.innerText = "Failed";
                    break;
                default:
                    statusBadge.classList.add("bg-secondary");
                    statusBadge.innerText = "Not Set";
            }

            const statusContainer = document.getElementById(
                "ViewInspectionStatus"
            );
            statusContainer.innerHTML = "";
            statusContainer.appendChild(statusBadge);

            document.getElementById("viewNotes").innerText =
                data.notes.String || "";
            document.getElementById("ViewdeviceSerialNumber").innerText =
                data.serial_number || "Unknown";

            // Populate checkboxes
            document.getElementById("ViewIsConspicuous").checked =
                data.is_conspicuous.Bool && data.is_conspicuous.Valid;
            document.getElementById("ViewIsAccessible").checked =
                data.is_accessible.Bool && data.is_accessible.Valid;
            document.getElementById("ViewIsAssignedLocation").checked =
                data.is_assigned_location.Bool &&
                data.is_assigned_location.Valid;
            document.getElementById("ViewIsSignVisible").checked =
                data.is_sign_visible.Bool && data.is_sign_visible.Valid;
            document.getElementById("ViewIsAntiTamperDeviceIntact").checked =
                data.is_anti_tamper_device_intact.Bool &&
                data.is_anti_tamper_device_intact.Valid;
            document.getElementById("ViewIsSupportBracketSecure").checked =
                data.is_support_bracket_secure.Bool &&
                data.is_support_bracket_secure.Valid;
            document.getElementById("ViewWorkOrderRequired").checked =
                data.work_order_required.Bool && data.work_order_required.Valid;
            document.getElementById(
                "ViewAreOperatingInstructionsClear"
            ).checked =
                data.are_operating_instructions_clear.Bool &&
                data.are_operating_instructions_clear.Valid;
            document.getElementById("ViewIsMaintenanceTagAttached").checked =
                data.is_maintenance_tag_attached.Bool &&
                data.is_maintenance_tag_attached.Valid;
            document.getElementById("ViewIsNoExternalDamage").checked =
                data.is_no_external_damage.Bool &&
                data.is_no_external_damage.Valid;
            document.getElementById("ViewIsChargeGaugeNormal").checked =
                data.is_charge_gauge_normal.Bool &&
                data.is_charge_gauge_normal.Valid;
            document.getElementById("ViewIsReplaced").checked =
                data.is_replaced.Bool && data.is_replaced.Valid;
            document.getElementById(
                "ViewAreMaintenanceRecordsComplete"
            ).checked =
                data.are_maintenance_records_complete.Bool &&
                data.are_maintenance_records_complete.Valid;

            // Show the modal
            $("#viewInspectionDetailsModal").modal("show");
        })
        .catch((error) => {
            console.error("Error fetching inspection details:", error);
        });
}
