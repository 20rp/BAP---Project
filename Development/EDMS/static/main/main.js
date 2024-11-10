import {
    clearAllNotifications,
    clearNotificationById,
    updateNotificationsUI,
} from "/static/main/notifications.js";

export function logout() {
    window.location.href = "/logout";
}

export function viewNotifications() {
    $("#notificationsModal").modal("show");
}

export function clearAllNotificationsHandler() {
    clearAllNotifications(); // Calls the function in notifications.js
}

export function clearNotificationHandler(deviceId) {
    clearNotificationById(deviceId); // Calls the function in notifications.js
}

export async function refreshNotificationsHandler() {
    console.log("Refreshing notifications..."); // Log to check if it's triggered unexpectedly

    const refreshButton = document.getElementById("refreshNotificationsBtn");

    // Disable the button immediately to prevent further clicks while processing
    if (refreshButton.disabled) return; // Prevent further clicks

    try {
        if (refreshButton) {
            refreshButton.disabled = true;
            const icon = refreshButton.querySelector(".fa-sync-alt");
            if (icon) {
                icon.classList.add("fa-spin");
            }
        }

        // Clear session storage to force fresh data
        sessionStorage.removeItem("notifications");
        sessionStorage.removeItem("clearedNotifications");

        // Get fresh notifications and update UI
        await updateNotificationsUI();
    } catch (error) {
        console.error("Error refreshing notifications:", error);
    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            const icon = refreshButton.querySelector(".fa-sync-alt");
            if (icon) {
                icon.classList.remove("fa-spin");
            }
        }
    }
}

function formatEntityType(entityType) {
    return entityType
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// Function to populate dropdowns with specific property mapping
export function populateDropdown(
    selector,
    url,
    defaultText = "Select an option",
    valueProperty,
    textProperty
) {
    const selects = document.querySelectorAll(selector);

    return fetch(url)
        .then((response) => response.json())
        .then((data) => {
            selects.forEach((select) => {
                // Clear previous options
                select.innerHTML = "";

                // Add default option
                const defaultOption = document.createElement("option");
                defaultOption.text = defaultText;
                defaultOption.value = "";
                defaultOption.selected = true;
                defaultOption.disabled = true;
                select.add(defaultOption);

                // Add data options
                data.forEach((item) => {
                    const option = document.createElement("option");
                    option.text = item[textProperty];
                    option.value = item[valueProperty];
                    select.add(option);
                });
            });
            return data; // Return the data for further processing if needed
        })
        .catch((error) => console.error("Error:", error));
}

export function showDeleteModal(id, entityType, entityName, currentUserId) {
    const deleteModal = document.getElementById("deleteModal");
    const deleteForm = document.getElementById("deleteForm");
    const currentUserIdInput = document.getElementById("deleteCurrentUserID");
    const deleteIdInput = document.getElementById("deleteId");
    const modalBody = deleteModal.querySelector(".modal-body p");
    const deleteButton = deleteModal.querySelector(".modal-footer .btn-danger");

    if (
        deleteModal &&
        deleteForm &&
        deleteIdInput &&
        currentUserIdInput &&
        modalBody &&
        deleteButton
    ) {
        // Format and capitalize the entityType
        const formattedEntityType = formatEntityType(entityType);

        // Update modal text
        modalBody.innerHTML = `Are you sure you want to delete ${formattedEntityType}: ${entityName}?`;
        deleteButton.textContent = `Delete ${formattedEntityType}`;

        // Add any additional logic here

        // if the current user id is passed, add to delete form action
        if (currentUserId) {
            deleteForm.action = `/api/${entityType}/${id}?currentUserId=${currentUserId}`;
        } else {
            deleteForm.action = `/api/${entityType}/${id}`;
        }

        deleteIdInput.value = id;
        currentUserIdInput.value = currentUserId;

        // Show the modal
        const modal = new bootstrap.Modal(deleteModal);
        modal.show();
    } else {
        console.error(
            "One or more elements required for delete modal not found"
        );
    }
}

// Event listener for delete form submission
document
    .getElementById("deleteForm")
    .addEventListener("submit", function (event) {
        event.preventDefault();

        fetch(this.action, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                // Add any other necessary headers here
            },
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.error) {
                    window.location.href = data.redirectURL;
                } else if (data.message) {
                    window.location.href = data.redirectURL;
                } else {
                    console.error("Error:", data);
                    // Handle errors (e.g., show an error message)
                }
            })
            .catch((error) => {
                console.error("Error:", error);
                // Handle errors (e.g., show an error message to the user)
            });
    });

// function to toggle dark mode
export function toggleDarkMode() {
    // check data-theme attribute on html element
    const html = document.documentElement;
    const currentTheme = html.getAttribute("data-bs-theme");

    // toggle data-theme attribute
    if (currentTheme === "dark") {
        html.setAttribute("data-bs-theme", "light");

        // change table header to secondary
        const tableHeaders = document.querySelectorAll("thead");
        tableHeaders.forEach((header) => {
            header.classList.remove("table-dark");
            header.classList.add("table-secondary");
        });

        // save the theme in local storage
        localStorage.setItem("theme", "light");
    } else {
        html.setAttribute("data-bs-theme", "dark");

        // change table header to dark
        const tableHeaders = document.querySelectorAll("thead");
        tableHeaders.forEach((header) => {
            header.classList.remove("table-secondary");
            header.classList.add("table-dark");
        });

        // save the theme in local storage
        localStorage.setItem("theme", "dark");
    }
}

// check if the theme is saved in local storage
const savedTheme = localStorage.getItem("theme");

// if the theme is saved, set the theme
if (savedTheme) {
    document.documentElement.setAttribute("data-bs-theme", savedTheme);
    // update the switch
    // use jqeury to upfdaste the switch with class name darkSwitch
    if (savedTheme === "dark") {
        $(".darkSwitch").prop("checked", true);

        // change table header to dark
        const tableHeaders = document.querySelectorAll("thead");
        tableHeaders.forEach((header) => {
            header.classList.remove("table-secondary");
            header.classList.add("table-dark");
        });
    }
}

// Make functions available to the browser
window.logout = logout;
window.viewNotifications = viewNotifications;
window.clearAllNotificationsHandler = clearAllNotificationsHandler;
window.clearNotificationHandler = clearNotificationHandler;
window.refreshNotificationsHandler = refreshNotificationsHandler;
window.showDeleteModal = showDeleteModal;
window.toggleDarkMode = toggleDarkMode;
window.populateDropdown = populateDropdown;
