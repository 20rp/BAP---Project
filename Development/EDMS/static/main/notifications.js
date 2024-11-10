export async function getAllDevices(buildingCode = "", siteId = "") {
    try {
        let url = "/api/emergency-device";
        const params = new URLSearchParams();
        if (buildingCode) params.append("building_code", buildingCode);
        if (siteId) params.append("site_id", siteId);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const devices = await response.json();
        return devices; // Return the devices instead of storing in global variable
    } catch (err) {
        console.error("Failed to fetch devices:", err);
        return []; // Return empty array in case of error
    }
}

export async function updateDeviceStatus(deviceId, status) {
    try {
        const response = await fetch(
            `/api/emergency-device/${deviceId}/status`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: status }),
            }
        );

        const data = await response.json();

        if (data.error) {
            console.error("Error:", data.error);
            window.location.href = data.redirectURL;
            throw new Error(data.error);
        } else if (data.message) {
            // Only redirect if redirectURL is provided
            if (data.redirectURL) {
                window.location.href = data.redirectURL;
            }
            return true; // Indicate success
        } else {
            console.error("Unexpected response:", data);
            throw new Error("Unexpected response");
        }
    } catch (error) {
        console.error(`Failed to update status for device ${deviceId}:`, error);
        return false; // Indicate failure
    }
}

// Initialize currentNotifications from sessionStorage or empty array
let currentNotifications =
    JSON.parse(sessionStorage.getItem("notifications")) || [];

export async function generateNotifications() {
    const allDevices = await getAllDevices();

    const currentDate = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(currentDate.getDate() + 30);

    // Helper function to calculate days difference
    const calculateDaysOverdue = (date) => {
        const diffTime = currentDate - new Date(date);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Helper function to check if a date is today or in the past
    const isDateDueOrPast = (date) => {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return targetDate <= today;
    };

    // Update device statuses first
    for (const device of allDevices) {
        let statusUpdated = false;

        // Skip updating if the status is already "Inspection Failed"
        if (device.status.String === "Inspection Failed") {
            continue; // Skip this device as it already has the "Inspection Failed" status
        }

        // Check inspection date
        if (
            device.next_inspection_date.Valid &&
            isDateDueOrPast(device.next_inspection_date.Time) &&
            device.status.String !== "Inspection Due"
        ) {
            const success = await updateDeviceStatus(
                device.emergency_device_id,
                "Inspection Due"
            );
            if (success) {
                device.status.String = "Inspection Due";
                statusUpdated = true;
            }
        }

        // Check expire date
        if (
            device.expire_date.Valid &&
            isDateDueOrPast(device.expire_date.Time) &&
            device.status.String !== "Expired" &&
            !statusUpdated
        ) {
            const success = await updateDeviceStatus(
                device.emergency_device_id,
                "Expired"
            );
            if (success) {
                device.status.String = "Expired";
            }
        }
    }

    // Clear all existing notifications for devices that had status changes
    const clearedDevices = getClearedNotifications();

    // Create notifications map
    const notificationMap = new Map();

    // Helper function to add or update device notification
    const updateDeviceNotification = (device, reason, days = null) => {
        // Always create a fresh notification entry
        notificationMap.set(device.emergency_device_id, {
            ...device,
            notification_details: [
                {
                    reason: reason,
                    days: days,
                },
            ],
        });
    };

    // Process each device for notifications
    allDevices.forEach((device) => {
        // Skip inactive devices
        if (device.status.String === "Inactive") {
            return;
        }

        // Clear any existing notifications for this device
        if (notificationMap.has(device.emergency_device_id)) {
            notificationMap.delete(device.emergency_device_id);
        }

        // Process notifications based on current status
        // Priority order is maintained by the order of these checks
        if (device.status.String === "Inspection Failed") {
            updateDeviceNotification(device, "Inspection Failed");
        } else if (
            device.status.String === "Expired" &&
            device.expire_date.Valid
        ) {
            const daysOverdue = calculateDaysOverdue(device.expire_date.Time);
            updateDeviceNotification(device, "Expired", daysOverdue);
        } else if (
            device.status.String === "Inspection Due" &&
            device.next_inspection_date.Valid
        ) {
            const daysOverdue = calculateDaysOverdue(
                device.next_inspection_date.Time
            );
            updateDeviceNotification(device, "Inspection Due", daysOverdue);
        } else {
            // Check for upcoming issues only if no current issues
            if (device.expire_date.Valid) {
                const expireDate = new Date(device.expire_date.Time);
                if (
                    expireDate > currentDate &&
                    expireDate <= thirtyDaysFromNow
                ) {
                    const daysUntil = Math.ceil(
                        (expireDate - currentDate) / (1000 * 60 * 60 * 24)
                    );
                    updateDeviceNotification(
                        device,
                        "Expiring Soon",
                        daysUntil
                    );
                }
            }

            if (
                !notificationMap.has(device.emergency_device_id) &&
                device.next_inspection_date.Valid
            ) {
                const inspectionDate = new Date(
                    device.next_inspection_date.Time
                );
                if (
                    inspectionDate > currentDate &&
                    inspectionDate <= thirtyDaysFromNow
                ) {
                    const daysUntil = Math.ceil(
                        (inspectionDate - currentDate) / (1000 * 60 * 60 * 24)
                    );
                    updateDeviceNotification(
                        device,
                        "Inspection Due Soon",
                        daysUntil
                    );
                }
            }
        }
    });

    // Convert map to array
    const notifications = Array.from(notificationMap.values());

    // Sort notifications by priority
    const priorityOrder = {
        "Inspection Failed": 0,
        Expired: 1,
        "Inspection Due": 2,
        "Expiring Soon": 3,
        "Inspection Due Soon": 4,
    };

    notifications.sort((a, b) => {
        const aPriority = priorityOrder[a.notification_details[0].reason];
        const bPriority = priorityOrder[b.notification_details[0].reason];

        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }

        // If same priority, sort by days overdue (highest first)
        return (
            (b.notification_details[0].days || 0) -
            (a.notification_details[0].days || 0)
        );
    });

    // Update global notifications list
    currentNotifications = notifications;

    // Filter out manually cleared notifications
    const filteredNotifications = notifications.filter(
        (device) => !clearedDevices.includes(device.emergency_device_id)
    );

    return filteredNotifications;
}

export async function refreshNotificationsPreservingCleared() {
    try {
        // Generate fresh notifications (this will already exclude cleared ones)
        const freshNotifications = await generateNotifications();

        // Update session storage with new notifications
        saveNotificationsToSession(freshNotifications);

        // Update the UI
        await updateNotificationsUI(freshNotifications);

        return freshNotifications;
    } catch (error) {
        console.error("Failed to refresh notifications:", error);
        throw error;
    }
}

// Add this for form submissions
export async function refreshAfterChange() {
    try {
        const freshNotifications = await generateNotifications();
        currentNotifications = freshNotifications;
        sessionStorage.setItem(
            "notifications",
            JSON.stringify(freshNotifications)
        );
        await updateNotificationsUI(freshNotifications);
    } catch (error) {
        console.error("Error refreshing notifications after change:", error);
    }
}

export function generateNotificationHTML(notifications) {
    // check if notifications lenght is 0 if yes return no notifications message
    if (notifications.length === 0) {
        return `
            <div class="alert alert-info" role="alert">

                No notifications to display.
            </div>
        `;
    }

    const getStatusBadge = (detail) => {
        const { reason, days } = detail;
        let badgeClass = "";
        let icon = "";
        let text = "";

        switch (reason) {
            case "Inspection Failed":
                badgeClass = "bg-danger text-light";
                icon = '<i class="text-danger fa fa-exclamation-circle"></i>';
                text = "Inspection Failed";
                break;
            case "Expired":
                badgeClass = "bg-danger text-light";
                icon = '<i class="text-danger fa fa-exclamation-circle"></i>';
                text = `Expired (${days} days ago)`;
                break;
            case "Inspection Due":
                badgeClass = "bg-danger text-light";
                icon = '<i class="text-danger fa fa-exclamation-circle"></i>';
                text = `Inspection Due (${days} days ago)`;
                break;
            case "Expiring Soon":
                badgeClass = "bg-warning text-black";
                icon =
                    '<i class="text-warning fa-solid fa-exclamation-triangle"></i>';
                text = `Expires (In ${days} days)`;
                break;
            case "Inspection Due Soon":
                badgeClass = "bg-warning text-black";
                icon =
                    '<i class="text-warning fa-solid fa-exclamation-triangle"></i>';
                text = `Inspection Due (In ${days} days)`;
                break;
        }

        return { badgeClass, icon, text };
    };

    let html = "";

    notifications.forEach((device) => {
        // Get highest priority notification detail
        const mainDetail = device.notification_details.reduce((a, b) =>
            priorityOrder[a.reason] < priorityOrder[b.reason] ? a : b
        );

        const { badgeClass, icon, text } = getStatusBadge(mainDetail);

        html += `
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title">
                        ${device.emergency_device_type_name}
                        ${icon}
                    </h5>
                    <div class="card-text">
                        <div class="d-flex justify-content-between">
                            <div>
                                <span>Serial Number: ${
                                    device.serial_number.String
                                }</span><br />
                                <span>Room: ${device.room_code}</span><br />
                                <span>Status: 
                                    <span class="badge ${badgeClass}">
                                        ${text}
                                    </span>
                                </span>
                            </div>
                            <div>
                                ${
                                    mainDetail.reason.includes("Inspection")
                                        ? `<button class="btn btn-primary" onclick="viewDeviceInspections(${device.emergency_device_id})">
                                        Inspect
                                    </button>`
                                        : ""
                                }
                                <button class="btn btn-secondary" onclick="clearNotificationHandler(${
                                    device.emergency_device_id
                                })">
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    return html;
}

function getClearedNotifications() {
    const cleared = sessionStorage.getItem("clearedNotifications");
    return cleared ? JSON.parse(cleared) : [];
}

function addToClearedNotifications(deviceId) {
    const clearedNotifications = getClearedNotifications();
    if (!clearedNotifications.includes(deviceId)) {
        clearedNotifications.push(deviceId);
        sessionStorage.setItem(
            "clearedNotifications",
            JSON.stringify(clearedNotifications)
        );
    }
}

// Function to save notifications to sessionStorage
function saveNotificationsToSession(notifications) {
    sessionStorage.setItem("notifications", JSON.stringify(notifications));
}

export function clearNotificationById(deviceId) {
    addToClearedNotifications(deviceId);
    currentNotifications = currentNotifications.filter(
        (device) => device.emergency_device_id !== deviceId
    );
    saveNotificationsToSession(currentNotifications);
    updateNotificationsUI(currentNotifications);
}

// Function to clear all notifications
export function clearAllNotifications() {
    currentNotifications = [];
    saveNotificationsToSession(currentNotifications);
    updateNotificationsUI(currentNotifications);
}

// Modify updateNotificationsUI to accept a forceRefresh parameter
export async function updateNotificationsUI(
    notifications,
    forceRefresh = false
) {
    try {
        if (!notifications || forceRefresh) {
            if (forceRefresh) {
                // Generate fresh notifications if force refresh
                notifications = await generateNotifications();
                saveNotificationsToSession(notifications);
            } else {
                // Check session storage first
                const storedNotifications =
                    sessionStorage.getItem("notifications");
                // check if storedNotifications is null
                if (storedNotifications) {
                    notifications = JSON.parse(storedNotifications);
                    // if storedNotifications is null then generate new notifications
                } else {
                    notifications = await generateNotifications();
                    saveNotificationsToSession(notifications);
                }
            }
        }

        const html = generateNotificationHTML(notifications);

        // Update the notifications section
        const notificationsElement = document.getElementById(
            "deviceNotificationsCards"
        );
        if (notificationsElement) {
            notificationsElement.innerHTML = html;
        } else {
            console.error("Notifications element not found");
        }

        // Update the notification count
        const notificationCountElement = document.querySelector(
            ".notification-count"
        );
        if (notificationCountElement) {
            notificationCountElement.textContent = notifications.length;
        } else {
            console.error("Notification count element not found");
        }

        // Keep currentNotifications in sync
        currentNotifications = notifications;

        // Add loading state management to the refresh button
        const refreshButton = document.querySelector(
            '[onclick="refreshNotificationsHandler()"]'
        );
        if (refreshButton) {
            refreshButton.disabled = false;
            const icon = refreshButton.querySelector(".fa-sync-alt");
            if (icon) {
                icon.classList.remove("fa-spin");
            }
        }
    } catch (error) {
        console.error("Failed to generate notifications:", error);
        const notificationsElement = document.getElementById(
            "deviceNotificationsCards"
        );
        if (notificationsElement) {
            notificationsElement.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    Failed to load notifications. Please try refreshing the page.
                </div>
            `;
        }

        const notificationCountElements = document.querySelectorAll(
            ".notification-count"
        );
        if (notificationCountElements) {
            notificationCountElements.forEach((element) => {
                element.textContent = "0";
            });
        }

        // Reset refresh button state on error
        const refreshButton = document.getElementById(
            "refreshNotificationsBtn"
        );
        if (refreshButton) {
            refreshButton.disabled = false;
            const icon = refreshButton.querySelector(".fa-sync-alt");
            if (icon) {
                icon.classList.remove("fa-spin");
            }
        }
    }
}
