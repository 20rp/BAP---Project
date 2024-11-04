// dashboard.js
import {
    getAllDevices,
    updateNotificationsUI,
} from "/static/main/notifications.js";

// Leaflet map setup
let map;

function initializeMap(containerId, options = {}) {
    const defaultOptions = {
        crs: L.CRS.Simple,
        minZoom: -1,
    };
    map = L.map(containerId, { ...defaultOptions, ...options });
}

function createEitTaradaleMap() {
    const svgDimensions = { width: 561.568, height: 962.941 };
    const minCoordinates = { x: 128.009, y: 82.331 };
    const imageUrl = "/static/site_maps/EIT_Taradale.svg";
    const bounds = [
        [0, 0],
        [svgDimensions.height, svgDimensions.width],
    ];

    L.imageOverlay(imageUrl, bounds).addTo(map);

    fetchBuildingsData()
        .then((data) => renderBuildings(data, svgDimensions, minCoordinates))
        .catch((error) =>
            console.error("Error fetching building data:", error)
        );

    map.fitBounds(bounds);
}

function fetchBuildingsData() {
    return fetch("static/assets/buildings.json").then((response) =>
        response.json()
    );
}

function renderBuildings(data, svgDimensions, minCoordinates) {
    data.buildings.forEach((building) => {
        const x = building.coordinates.x - minCoordinates.x;
        const y =
            svgDimensions.height - (building.coordinates.y - minCoordinates.y);

        const rectangle = L.rectangle([
            [y - 19, x],
            [y, x + 19],
        ]).addTo(map);

        rectangle.on("click", () => {
            filterByBuilding(building.name);
            filterByRoom();
            console.log("Building clicked:", building.name);
        });
    });
}

function getFilterOptions() {
    fetchAndPopulateSelect(
        "/api/site",
        "siteFilter",
        "site_name",
        "site_id",
        "All Sites"
    );
    setupBuildingFilter();
    setupRoomFilter();
    fetchAndPopulateSelect(
        "/api/emergency-device-type",
        "deviceTypeFilter",
        "emergency_device_type_name",
        null,
        "All Device Types"
    );
}

export function clearFilters() {
    // Reset each filter dropdown to its first option (except site filter)
    document.getElementById("buildingFilter").selectedIndex = 0;
    document.getElementById("roomFilter").selectedIndex = 0;
    document.getElementById("deviceTypeFilter").selectedIndex = 0;
    document.getElementById("statusFilter").selectedIndex = 0;

    // Reset active filters
    activeFilters = {
        room: null,
        deviceType: null,
        status: null,
    };

    filteredDevices = [...allDevices]; // Reset to original devices
    clearTableBody();
    loadDevicesAndUpdateTable();
}

function fetchAndPopulateSelect(
    url,
    selectId,
    textKey,
    valueKey,
    defaultOptionText
) {
    fetch(url)
        .then((response) => response.json())
        .then((data) => {
            const select = document.getElementById(selectId);
            select.innerHTML = "";

            // Add the default option
            addDefaultOption(select, defaultOptionText);

            // Check if data is valid and is an array
            if (data && Array.isArray(data) && data.length > 0) {
                data.forEach((item) => {
                    const option = document.createElement("option");
                    option.text = item[textKey];
                    if (valueKey) option.value = item[valueKey];
                    select.add(option);
                });
            } else {
                console.log(`No data available for ${selectId}`);
            }
        })
        .catch((error) => {
            console.error(`Error fetching ${selectId} data:`, error);
        });
}

function addDefaultOption(select, text) {
    const defaultOption = document.createElement("option");
    defaultOption.text = text;
    defaultOption.selected = true;
    select.add(defaultOption);
}

function setupBuildingFilter() {
    document.getElementById("buildingFilter").addEventListener("change", () => {
        filterByBuilding();
        clearRoomFilter();
        clearTableBody();
    });
}

function setupRoomFilter() {
    document.getElementById("buildingFilter").addEventListener("change", () => {
        filterByRoom();
    });
}

function clearRoomFilter() {
    const roomSelect = document.getElementById("roomFilter");
    roomSelect.innerHTML = "";
    addDefaultOption(roomSelect, "All Rooms");
}

function clearBuildingFilter() {
    const buildingSelect = document.getElementById("buildingFilter");
    buildingSelect.innerHTML = "";
    addDefaultOption(buildingSelect, "All Buildings");
}

function filterBySite() {
    var siteName =
        document.getElementById("siteFilter").selectedOptions[0].text;

    console.log("Filtering by site:", siteName);
    var siteId = document.getElementById("siteFilter").value;

    if (siteId !== "All Sites") {
        fetchAndPopulateSelect(
            `/api/building?siteId=${siteId}`,
            "buildingFilter",
            "building_code",
            "building_id",
            "All Buildings"
        );

        clearRoomFilter();
    }

    console.log("Selected site ID:", siteId);

    // Clear the table body
    clearTableBody();

    if (siteName === "All Sites") {
        hideMap();
        loadDevicesAndUpdateTable();
        return;
    }

    if (siteId === "1") {
        // Hard coded - EIT Taradale should always also be id = 1, as its the first site inserted into the database (see seed.go)
        // Clear the map layers
        map.eachLayer((layer) => {
            if (
                layer instanceof L.ImageOverlay ||
                layer instanceof L.Rectangle
            ) {
                map.removeLayer(layer);
            }
        });
        showMap();
        createEitTaradaleMap();
        loadDevicesAndUpdateTable("", siteId);
        return;
    }

    loadDevicesAndUpdateTable("", siteId);
    clearRoomFilter();
    updateMapForSite(siteId);
}

function filterByBuilding(buildingCode) {
    const buildingFilter = document.getElementById("buildingFilter");
    var siteId;

    if (buildingCode) {
        siteId = "1";
        // Loop through `buildingFilter` options to select the one with matching text
        for (const option of buildingFilter.options) {
            if (option.text === buildingCode) {
                option.selected = true;
                break;
            }
        }
    } else {
        // If `buildingCode` is not provided, use the selected dropdown value
        buildingCode = buildingFilter.selectedOptions[0].text;
        siteId = document.getElementById("siteFilter").value;
    }

    // Fetch devices based on `buildingCode` and `siteId`
    if (buildingCode === "All Buildings" || buildingFilter.value === "") {
        loadDevicesAndUpdateTable("", siteId);
    } else {
        console.log("Fetching devices for building:", buildingCode);
        console.log("Site ID:", siteId);
        loadDevicesAndUpdateTable(buildingCode, siteId);
    }
}

function filterByRoom() {
    const selectedBuilding = document.getElementById("buildingFilter").value;

    if (selectedBuilding != "All Buildings") {
        fetch(`/api/room?buildingId=${selectedBuilding}`)
            .then((response) => response.json())
            .then((data) => {
                const roomSelect = document.getElementById("roomFilter");
                roomSelect.innerHTML = "";

                // Add default "All Rooms" option
                addDefaultOption(roomSelect, "All Rooms");

                // Add room options
                data.forEach((room) => {
                    const option = document.createElement("option");
                    option.value = room.room_id; // Store the ID as the value
                    option.text = room.room_code; // Show the code as the text
                    roomSelect.add(option);
                });
            });
        return;
    }
}

function clearTableBody() {
    const tableBody = document.getElementById("emergency-device-body");
    if (tableBody) {
        tableBody.innerHTML = "";
    } else {
        console.error("Table body element not found");
    }
}

function updateMapForSite(siteId) {
    fetch(`/api/site/${siteId}`)
        .then((response) => response.json())
        .then((data) => {
            // Check if site has a map image
            if (!data.site_map_image_path.String) {
                hideMap();
                return;
            }
            showMap();

            const imageUrl = data.site_map_image_path.String;

            const image = new Image();
            image.src = imageUrl;
            image.onload = function () {
                const imgWidth = this.width;
                const imgHeight = this.height;

                const newBounds = [
                    [0, 0],
                    [imgHeight, imgWidth],
                ];

                map.eachLayer((layer) => {
                    if (
                        layer instanceof L.ImageOverlay ||
                        layer instanceof L.Rectangle
                    ) {
                        map.removeLayer(layer);
                    }
                });

                L.imageOverlay(imageUrl, newBounds).addTo(map);
                map.fitBounds(newBounds);
            };
        })
        .catch((error) => console.error("Error updating map:", error));
}

function hideMap() {
    document.getElementById("map").classList.add("d-none");
    document.getElementById("toggleMap").classList.add("d-none");
    // Change the device list width to col-xxl-12
    document.querySelector(".device-list").classList.remove("col-xxl-9");
    document.querySelector(".device-list").classList.add("col-xxl-12");
}

function showMap() {
    document.getElementById("map").classList.remove("d-none");
    document.getElementById("toggleMap").classList.remove("d-none");
    // Change the device list width to col-xxl-9
    document.querySelector(".device-list").classList.remove("col-xxl-12");
    document.querySelector(".device-list").classList.add("col-xxl-9");
}

// Update the event listener to include table clearing
document.getElementById("siteFilter").addEventListener("change", () => {
    filterBySite();
    clearBuildingFilter();
    clearTableBody();
});

// Initialize the map and populate filter options
initializeMap("map");
getFilterOptions();

let currentPage = 1;
let rowsPerPage = 10;
let allDevices = [];

// Keep track of active filters
let activeFilters = {
    room: null,
    deviceType: null,
    status: null,
};

// Add event listeners for the new filters
document.getElementById("roomFilter").addEventListener("change", () => {
    filterTableByRoom();
    clearTableBody();
    updateTable();
});

document.getElementById("deviceTypeFilter").addEventListener("change", () => {
    filterTableByDeviceType();
    clearTableBody();
    updateTable();
});

document.getElementById("statusFilter").addEventListener("change", () => {
    filterTableByStatus();
    clearTableBody();
    updateTable();
});

let filteredDevices = [];

// Modify the dashboard version of getAllDevices to update the table
async function loadDevicesAndUpdateTable(buildingCode = "", siteId = "") {
    const devices = await getAllDevices(buildingCode, siteId);
    allDevices = devices; // Update global variable if needed
    filteredDevices = devices; // Initialize filtered devices

    updateTable();

    if (devices.length === 0) {
        const tbody = document.getElementById("emergency-device-body");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="11" class="text-center">No devices found.</td></tr>`;
        }
    }
}

function updateTable() {
    const tbody = document.getElementById("emergency-device-body");
    if (!tbody) {
        console.error("Table body element not found");
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageDevices = filteredDevices.slice(startIndex, endIndex);

    // Clear table if no devices
    if (!Array.isArray(pageDevices) || pageDevices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center">No devices found.</td></tr>`;
    } else {
        tbody.innerHTML = pageDevices.map(formatDeviceRow).join("");
    }

    updatePaginationControls();
}

// Filter functions for each criteria
function filterTableByRoom() {
    const roomSelect = document.getElementById("roomFilter");
    const selectedRoom = roomSelect.value;
    const selectedRoomText = roomSelect.selectedOptions[0].text;

    console.log("Selected room value:", selectedRoom);
    console.log("Selected room text:", selectedRoomText);
    console.log(
        "Sample device room codes:",
        allDevices.slice(0, 3).map((d) => d.room_code)
    );

    if (selectedRoom === "All Rooms") {
        filteredDevices = [...allDevices];
    } else {
        // Try matching against both the value and text of the selected room
        filteredDevices = allDevices.filter(
            (device) =>
                device.room_code === selectedRoomText ||
                device.room_id === selectedRoom
        );
    }
    activeFilters.room = selectedRoomText;
    applyFilters();

    console.log("Filtered devices count:", filteredDevices.length);
}

function filterTableByDeviceType() {
    const selectedDeviceType =
        document.getElementById("deviceTypeFilter").selectedOptions[0].text;

    if (selectedDeviceType === "All Device Types") {
        filteredDevices = [...allDevices];
    } else {
        filteredDevices = allDevices.filter(
            (device) => device.emergency_device_type_name === selectedDeviceType
        );
    }
    activeFilters.deviceType = selectedDeviceType;
    applyFilters();
}

function filterTableByStatus() {
    const selectedStatus = document.getElementById("statusFilter").value;

    // Check for either the default "Status" option or "All Statuses"
    if (selectedStatus === "Status" || selectedStatus === "All Statuses") {
        filteredDevices = [...allDevices];
    } else {
        filteredDevices = allDevices.filter(
            (device) => device.status.String === selectedStatus
        );
    }
    activeFilters.status = selectedStatus;
    applyFilters();
}

// Apply all active filters
function applyFilters() {
    // Start with all devices
    filteredDevices = [...allDevices];

    // Apply room filter if active
    if (activeFilters.room && activeFilters.room !== "All Rooms") {
        filteredDevices = filteredDevices.filter(
            (device) => device.room_code === activeFilters.room
        );
    }

    // Apply device type filter if active
    if (
        activeFilters.deviceType &&
        activeFilters.deviceType !== "Device Type" &&
        activeFilters.deviceType !== "All Device Types"
    ) {
        filteredDevices = filteredDevices.filter(
            (device) =>
                device.emergency_device_type_name === activeFilters.deviceType
        );
    }

    // Apply status filter if active
    if (
        activeFilters.status &&
        activeFilters.status !== "Status" &&
        activeFilters.status !== "All Statuses"
    ) {
        filteredDevices = filteredDevices.filter(
            (device) => device.status.String === activeFilters.status
        );
    }

    updateTable();
}

//debugging
const selectedRoom = document.getElementById("roomFilter").value;
console.log("Selected room:", selectedRoom);
console.log(
    "Device room codes:",
    allDevices.map((device) => device.room_code)
);

// JavaScript
function updatePaginationControls() {
    const totalPages = Math.ceil(allDevices.length / rowsPerPage);
    const paginationEl = document.querySelector(".pagination");
    const isMobile = window.innerWidth < 768; // Detect mobile devices

    let paginationHTML = `
        <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
            <a class="page-link" href="#" data-page="${
                currentPage - 1
            }" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;

    function addPageNumber(pageNum) {
        paginationHTML += `
            <li class="page-item ${
                currentPage === pageNum ? "active" : ""
            }" aria-current="page">
                <a class="page-link" href="#" data-page="${pageNum}">${pageNum}</a>
            </li>
        `;
    }

    function addEllipsis() {
        paginationHTML += `
            <li class="page-item disabled">
                <span class="page-link">...</span>
            </li>
        `;
    }

    if (isMobile) {
        // Simplified pagination for mobile
        if (totalPages <= 3) {
            for (let i = 1; i <= totalPages; i++) {
                addPageNumber(i);
            }
        } else {
            addPageNumber(1);
            if (currentPage !== 1 && currentPage !== totalPages) {
                addPageNumber(currentPage);
            }
            addPageNumber(totalPages);
        }
    } else {
        // Desktop pagination (keep your existing logic here)
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                addPageNumber(i);
            }
        } else {
            addPageNumber(1);
            if (currentPage > 3) addEllipsis();

            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);

            if (currentPage <= 3) {
                end = 4;
            } else if (currentPage >= totalPages - 2) {
                start = totalPages - 3;
            }

            for (let i = start; i <= end; i++) {
                addPageNumber(i);
            }

            if (currentPage < totalPages - 2) addEllipsis();
            addPageNumber(totalPages);
        }
    }

    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
            <a class="page-link" href="#" data-page="${
                currentPage + 1
            }" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;

    paginationEl.innerHTML = paginationHTML;

    function handlePaginationClick(e) {
        e.preventDefault();
        e.stopPropagation();

        let target = e.target.closest(".page-link");

        if (target && target.hasAttribute("data-page")) {
            const newPage = parseInt(target.getAttribute("data-page"), 10);

            if (
                newPage !== currentPage &&
                newPage > 0 &&
                newPage <= totalPages
            ) {
                currentPage = newPage;
                updateTable();
            }
        }
    }

    // Remove existing event listeners
    paginationEl.removeEventListener("click", handlePaginationClick);
    paginationEl.removeEventListener("touchstart", handlePaginationClick);

    // Add event listeners to the pagination container
    paginationEl.addEventListener("click", handlePaginationClick);
    paginationEl.addEventListener("touchstart", handlePaginationClick);
}

// Event listener for rows per page dropdown
document.getElementById("rowsPerPage").addEventListener("change", (e) => {
    rowsPerPage = parseInt(e.target.value);
    currentPage = 1; // Reset to first page when changing rows per page
    updateTable();
});

// Initial fetch without filtering
loadDevicesAndUpdateTable();

if (role === "Admin") {
    updateNotificationsUI();
}

function formatDeviceRow(device) {
    if (!device) return "";
    const formatDateMonthYear = (dateString) =>
        formatDate(dateString, { year: "numeric", month: "long" });
    const formatDateFull = (dateString) =>
        formatDate(dateString, {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Pacific/Auckland",
        });

    const badgeClass = getBadgeClass(device.status.String);
    const buttons = getActionButtons(device);

    // Declare isAdmin within the function
    let isAdmin = false;

    // Ensure role is defined and check for "Admin"
    if (role === "Admin") {
        isAdmin = true;
    }

    return `
        <tr>
            <td data-label="Device Type">${
                device.emergency_device_type_name
            }</td>
            <td data-label="Extinguisher Type">${
                device.extinguisher_type_name.String
            }</td>
            <td data-label="Room">${device.room_code}</td>
            <td data-label="Serial Number">${device.serial_number.String}</td>
            <td data-label="Manufacture Date">${formatDateMonthYear(
                device.manufacture_date.Time
            )}</td>
            <td data-label="Expire Date">${formatDateMonthYear(
                device.expire_date.Time
            )}</td>
            ${
                isAdmin
                    ? `<td data-label="Last Inspection Date">${formatDateFull(
                          device.last_inspection_datetime.Time
                      )}</td>`
                    : ""
            }
            ${
                isAdmin
                    ? `<td data-label="Next Inspection Date">${formatDateFull(
                          device.next_inspection_date.Time
                      )}</td>`
                    : ""
            }
            <td data-label="Size">${device.size.String}</td>
            <td data-label="Status">
                <span class="badge ${badgeClass}">${device.status.String}</span>
            </td>
            <td>
                <div class="btn-group">
                    ${buttons}
                </div>
            </td>
        </tr>
    `;
}

function formatDate(dateString, options) {
    if (!dateString || dateString === "0001-01-01T00:00:00Z") {
        return "N/A";
    }
    return new Date(dateString).toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland", // Ensure the correct timezone
        ...options,
    });
}

function getBadgeClass(status) {
    switch (status) {
        case "Active":
            return "text-bg-success";
        case "Expired":
            return "text-bg-warning";
        case "Inspection Failed":
            return "text-bg-danger";
        case "Inactive":
            return "text-bg-secondary";
        default:
            return "text-bg-warning";
    }
}

export function getActionButtons(device) {
    let buttons = `
        <button class="btn btn-primary p-2" 
                onclick="deviceNotes('${device.description.String}')" 
                title="View Notes">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" 
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 2v4"/>
                <path d="M12 2v4"/>
                <path d="M16 2v4"/>
                <rect width="16" height="18" x="4" y="4" rx="2"/>
                <path d="M8 10h6"/>
                <path d="M8 14h8"/>
                <path d="M8 18h5"/>
            </svg>
        </button>`;

    if (role === "Admin") {
        const isFireExtinguisher =
            device.emergency_device_type_name === "Fire Extinguisher";

        if (isFireExtinguisher) {
            buttons += `
                <button class="btn btn-secondary p-2 ml-2" 
                        onclick="viewDeviceInspections(${device.emergency_device_id})"
                        title="Inspect Device">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" 
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m8 11 2 2 4-4"/>
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.3-4.3"/>
                    </svg>
                </button>`;
        }

        buttons += `
            <button class="btn btn-warning p-2 ml-2" 
                    onclick="editDevice(${device.emergency_device_id})"
                    title="Edit Device">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    <path d="m15 5 4 4"/>
                </svg>
            </button>
            <button class="btn btn-danger p-2 ml-2" 
                    onclick="showDeleteModal(${device.emergency_device_id},'emergency-device', '<br>${device.emergency_device_type_name} - Serial Number: ${device.serial_number.String}')"
                    title="Delete Device">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
            </button>
        `;
    }
    return buttons;
}

// Function to clear building and room options
function clearBuildingAndRoom() {
    const buildingSelects = document.querySelectorAll(".buildingInput");
    const roomSelects = document.querySelectorAll(".roomInput");
    buildingSelects.forEach((select) => {
        select.innerHTML =
            "<option value='' selected disabled>Select a Building</option>";
    });
    roomSelects.forEach((select) => {
        select.innerHTML =
            "<option value='' selected disabled>Select a Room</option>";
    });
}

export function addDevice() {
    document.getElementById("addDeviceForm").reset();
    document.getElementById("addDeviceForm").classList.remove("was-validated");

    const emergencyDeviceTypePromise = populateDropdown(
        ".emergencyDeviceTypeInput",
        "/api/emergency-device-type",
        "Select Device Type",
        "emergency_device_type_id",
        "emergency_device_type_name"
    );

    const extinguisherTypePromise = populateDropdown(
        ".extinguisherTypeInput",
        "/api/extinguisher-type",
        "Select Extinguisher Type",
        "extinguisher_type_id",
        "extinguisher_type_name"
    );

    const sitePromise = populateDropdown(
        ".siteInput",
        "/api/site",
        "Select a Site",
        "site_id",
        "site_name"
    );

    Promise.all([
        emergencyDeviceTypePromise,
        extinguisherTypePromise,
        sitePromise,
    ])
        .then(() => {
            // Event listener for site change
            document
                .querySelector(".siteInput")
                .addEventListener("change", (event) => {
                    const selectedSiteId = event.target.value;
                    clearBuildingAndRoom();

                    if (selectedSiteId) {
                        fetchAndPopulateBuildings(selectedSiteId);
                    }
                });

            // Event listener for building change
            document
                .querySelector(".buildingInput")
                .addEventListener("change", (event) => {
                    const selectedBuildingId = event.target.value;

                    if (selectedBuildingId) {
                        fetchAndPopulateRooms(selectedBuildingId);
                    }
                });

            // Show the modal after all dropdowns are populated
            $("#addDeviceModal").modal("show");
        })
        .catch((error) => {
            console.error("Error loading dropdown data:", error);
        });
}

function editDevice(deviceId) {
    // Clear the form before showing the modal
    document.getElementById("editDeviceForm").reset();
    document.getElementById("editDeviceForm").classList.remove("was-validated");

    // Function to handle visibility of extinguisher-specific fields
    function updateExtinguisherFields() {
        const selectElement = document.querySelector(
            "#editEmergencyDeviceTypeInput"
        );
        const selectedOption =
            selectElement.options[selectElement.selectedIndex];
        const selectedDeviceType = selectedOption.textContent;
        console.log(selectedDeviceType);

        if (selectedDeviceType !== "Fire Extinguisher") {
            // Hide and clear extinguisher-specific fields if not a Fire Extinguisher
            document
                .querySelector(".editExtinguisherTypeInputDiv")
                .classList.add("d-none");
            document.querySelector("#editExtinguisherTypeInput").value = ""; // Clear selected value
        } else {
            // Show extinguisher-specific fields and set default
            document
                .querySelector(".editExtinguisherTypeInputDiv")
                .classList.remove("d-none");
        }
    }

    // Clear the form before showing the modal
    document.getElementById("editDeviceForm").reset();
    document.getElementById("editDeviceForm").classList.remove("was-validated");
    document.getElementById("editDeviceID").value = deviceId;

    // Fetch the dropdown data
    const emergencyDeviceTypePromise = populateDropdown(
        ".emergencyDeviceTypeInput",
        "/api/emergency-device-type",
        "Select Device Type",
        "emergency_device_type_id",
        "emergency_device_type_name"
    );

    const extinguisherTypePromise = populateDropdown(
        ".extinguisherTypeInput",
        "/api/extinguisher-type",
        "Select Extinguisher Type",
        "extinguisher_type_id",
        "extinguisher_type_name"
    );

    const sitePromise = populateDropdown(
        ".editSiteInput",
        "/api/site",
        "Select a Site",
        "site_id",
        "site_name"
    );

    // Wait for all dropdowns to be populated before proceeding
    Promise.all([
        emergencyDeviceTypePromise,
        extinguisherTypePromise,
        sitePromise,
    ])
        .then(() => {
            // Event listener for site change
            document
                .querySelector(".editSiteInput")
                .addEventListener("change", (event) => {
                    const selectedSiteId = event.target.value;
                    clearBuildingAndRoom();

                    if (selectedSiteId) {
                        fetchAndPopulateBuildings(selectedSiteId);
                    }
                });

            // Event listener for building change
            document
                .querySelector(".editBuildingInput")
                .addEventListener("change", (event) => {
                    const selectedBuildingId = event.target.value;

                    if (selectedBuildingId) {
                        fetchAndPopulateRooms(selectedBuildingId);
                    }
                });

            // Fetch the device data
            fetch(`/api/emergency-device/${deviceId}`)
                .then((response) => response.json())
                .then((data) => {
                    // Populate the form with the data
                    document.getElementById(
                        "editEmergencyDeviceTypeInput"
                    ).value = data.emergency_device_type_id;
                    document.getElementById("editExtinguisherTypeInput").value =
                        data.extinguisher_type_id.Int64;
                    console.log(data.extinguisher_type_id.Int64);
                    document.getElementById("editSerialNumberInput").value =
                        data.serial_number.String;
                    document.getElementById("editManufactureDateInput").value =
                        data.manufacture_date.Time.split("T")[0];
                    document.getElementById("editSizeInput").value =
                        data.size.String;
                    document.getElementById("editDescriptionInput").value =
                        data.description.String;
                    document.getElementById("editSiteInput").value =
                        data.site_id;
                    document.getElementById("editStatusInput").value =
                        data.status.String;

                    // Populate the building and room dropdowns
                    fetchAndPopulateBuildings(data.site_id)
                        .then(() => fetchAndPopulateRooms(data.building_id))
                        .then(() => {
                            // Set the building and room values
                            document.getElementById("editBuildingInput").value =
                                data.building_id;
                            document.getElementById("editRoomInput").value =
                                data.room_id;
                        });

                    // Check and update visibility of extinguisher fields
                    updateExtinguisherFields();

                    // Check if status is "Inspection Failed" or "Inspection Due" and disable the dropdown
                    if (
                        data.status.String === "Inspection Failed" ||
                        data.status.String === "Inspection Due"
                    ) {
                        document.getElementById(
                            "editStatusInput"
                        ).disabled = true;

                        if (data.status.String === "Inspection Failed") {
                            var option = document.createElement("option");
                            option.text = "Inspection Failed";
                            option.value = "Inspection Failed";
                            document
                                .getElementById("editStatusInput")
                                .add(option);
                            document.getElementById("editStatusInput").value =
                                "Inspection Failed";
                        }

                        if (data.status.String === "Inspection Due") {
                            var option = document.createElement("option");
                            option.text = "Inspection Due";
                            option.value = "Inspection Due";
                            document
                                .getElementById("editStatusInput")
                                .add(option);
                            // Set the value of the dropdown to "Inspection Due"
                            document.getElementById("editStatusInput").value =
                                "Inspection Due";
                        }
                    } else {
                        // If the status is not "Inspection Failed" or "Inspection Due", enable the dropdown
                        document.getElementById(
                            "editStatusInput"
                        ).disabled = false;
                    }

                    // Now remove options that are not needed based on current status
                    if (data.status.String !== "Inspection Failed") {
                        // Remove the option from the dropdown where value = "Inspection Failed"
                        let statusInput =
                            document.getElementById("editStatusInput");
                        for (let i = 0; i < statusInput.options.length; i++) {
                            if (
                                statusInput.options[i].value ===
                                "Inspection Failed"
                            ) {
                                statusInput.remove(i);
                                break; // Exit loop after removing the option
                            }
                        }
                    }

                    if (data.status.String !== "Inspection Due") {
                        // Remove the option from the dropdown where value = "Inspection Due"
                        let statusInput =
                            document.getElementById("editStatusInput");
                        for (let i = 0; i < statusInput.options.length; i++) {
                            if (
                                statusInput.options[i].value ===
                                "Inspection Due"
                            ) {
                                statusInput.remove(i);
                                break; // Exit loop after removing the option
                            }
                        }
                    }

                    $("#editDeviceModal").modal("show");
                });
        })
        .catch((error) => {
            console.error("Error loading dropdown data:", error);
        });

    document
        .querySelector("#editEmergencyDeviceTypeInput")
        .addEventListener("change", updateExtinguisherFields);
}

function fetchAndPopulateBuildings(siteId) {
    return fetch(`/api/building?siteId=${siteId}`)
        .then((response) => response.json())
        .then((data) => {
            const selects = document.querySelectorAll(
                ".buildingInput, .editBuildingInput"
            );
            selects.forEach((select) => {
                select.innerHTML =
                    "<option value='' selected disabled>Select a Building</option>";
                data.forEach((item) => {
                    const option = document.createElement("option");
                    option.text = item.building_code;
                    option.value = item.building_id;
                    select.add(option);
                });

                // If there's only one building, select it automatically
                if (data.length === 1) {
                    select.value = data[0].building_id;
                    select.dispatchEvent(new Event("change"));
                }
            });
            return data;
        })
        .catch((error) => console.error("Error:", error));
}

function fetchAndPopulateRooms(buildingId) {
    return fetch(`/api/room?buildingId=${buildingId}`)
        .then((response) => response.json())
        .then((data) => {
            const selects = document.querySelectorAll(
                ".roomInput",
                ".editRoomInput"
            );
            selects.forEach((select) => {
                select.innerHTML =
                    "<option value='' selected disabled>Select a Room</option>";
                data.forEach((item) => {
                    const option = document.createElement("option");
                    option.text = item.room_code;
                    option.value = item.room_id;
                    select.add(option);
                });
            });
            return data;
        })
        .catch((error) => console.error("Error:", error));
}

/// Fetch the form and the submit button
const addDeviceForm = document.querySelector("#addDeviceForm");
const addDeviceButton = document.querySelector("#addDeviceBtn");
/// Fetch the form and the submit button
const editDeviceForm = document.querySelector("#editDeviceForm");
const editDeviceButton = document.querySelector("#editDeviceBtn");

// Function to validate select elementsvalidateDateshandle
function validateSelect(selectElement) {
    if (selectElement.value === "") {
        selectElement.setCustomValidity("Please make a selection");
    } else {
        selectElement.setCustomValidity("");
    }
}

// Function to validate length for input and textarea elements
function validateLength(element, maxLength) {
    if (element.value.length > maxLength) {
        element.setCustomValidity(
            `This field is too long, maximum ${maxLength} characters.`
        );
    } else {
        element.setCustomValidity("");
    }
}

// Function to handle device type changes
function handleDeviceTypeChange(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const selectedDeviceType = selectedOption.textContent;
    const isEdit = event.target.id === "editEmergencyDeviceTypeInput";
    const prefix = isEdit ? "edit" : "";

    if (selectedDeviceType !== "Fire Extinguisher") {
        // Clear and hide extinguisher type
        const extinguisherTypeInput = document.querySelector(
            `#${prefix}ExtinguisherTypeInput`
        );
        if (extinguisherTypeInput) {
            extinguisherTypeInput.value = "";
            document
                .querySelector(`.${prefix}ExtinguisherTypeInputDiv`)
                .classList.add("d-none");
        }
    } else {
        // Show fields for Fire Extinguisher
        document
            .querySelector(`.${prefix}ExtinguisherTypeInputDiv`)
            .classList.remove("d-none");
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // Add change event listeners to device type inputs
    const deviceTypeInputs = document.querySelectorAll(
        ".emergencyDeviceTypeInput"
    );
    deviceTypeInputs.forEach((input) => {
        input.addEventListener("change", handleDeviceTypeChange);
    });

    const description = document.querySelector(".descriptionInput");
    const editDescriptionInput = document.querySelector(
        "#editDescriptionInput"
    );
    const editManufactureDateInput = document.querySelector(
        "#editManufactureDateInput"
    );
    // Validate edit description length
    editDescriptionInput.addEventListener("input", function () {
        validateLength(this, 255);
    });

    // Validate description length
    description.addEventListener("input", function () {
        validateLength(this, 255);
    });

    // Add event listener for status validation
    document.getElementById("status").addEventListener("change", function () {
        validateAddStatus();
    });

    // Add event listeners to select elements
    document
        .querySelectorAll(
            ".emergencyDeviceTypeInput, .siteInput, .buildingInput, .roomInput"
        )
        .forEach((select) => {
            select.addEventListener("change", function () {
                validateSelect(this);
            });
        });

    // Add event listener for status validation
    // Check if device status is "Expired" then check that the expire date is in the past
    document
        .getElementById("editStatusInput")
        .addEventListener("change", validateEditStatus);

    function validateEditStatus() {
        const statusInput = document.getElementById("editStatusInput");
        const statusFeedback = document.getElementById("editStatusFeedback");
        const manufactureDateInput = document.getElementById(
            "editManufactureDateInput"
        );

        if (statusInput.value === "Expired") {
            // Check if manufacture date is empty return false
            if (manufactureDateInput.value === "") {
                statusInput.setCustomValidity(
                    "Please enter a manufacture date before setting status to 'Expired'"
                );
                statusFeedback.textContent =
                    "Please enter a manufacture date before setting status to 'Expired'";
                manufactureDateInput.setCustomValidity(
                    "Please enter a manufacture date before setting status to 'Expired'"
                );
                document.getElementById(
                    "editManufactureDateFeedback"
                ).textContent =
                    "Please enter a manufacture date before setting status to 'Expired'";
                return false;
            }
            // Get manufacture date and calculate expire date (manufacture date + 5 years)
            const manufactureDate = document.getElementById(
                "editManufactureDateInput"
            ).value;
            const expireDate = new Date(manufactureDate);
            expireDate.setFullYear(expireDate.getFullYear() + 5);
            console.log("Calculated Expire Date:", expireDate);

            // Get the current date and set its time to midnight for accurate comparison
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            console.log("Current Date:", currentDate);

            // If expireDate is in the future, set custom validity error
            if (expireDate > currentDate) {
                statusInput.setCustomValidity(
                    "Device status is 'Expired' but the expire date (manufacture date + 5 years) is in the future."
                );
                statusFeedback.textContent =
                    "Device status is 'Expired' but the expire date (manufacture date + 5 years) is in the future.";
                manufactureDateInput.setCustomValidity(
                    "Manufacture date cannot be within the past 5 years if status is 'Expired'"
                );

                document.getElementById(
                    "editManufactureDateFeedback"
                ).textContent =
                    "Manufacture date cannot be within the past 5 years if status is 'Expired'";
                return false;
            }

            // Clear any previous custom validity message if status is correctly "Expired"
            statusInput.setCustomValidity("");
            statusFeedback.textContent = "";
            manufactureDateInput.setCustomValidity("");
            document.getElementById("editManufactureDateFeedback").textContent =
                "";
            return true;
        }

        // Clear any previous custom validity message if status is not "Expired"
        statusInput.setCustomValidity("");
        statusFeedback.textContent = "";
        manufactureDateInput.setCustomValidity("");
        document.getElementById("editManufactureDateFeedback").textContent = "";
        return true;
    }

    function validateAddStatus() {
        const statusInput = document.getElementById("status");
        const statusFeedback = document.getElementById("statusFeedback");
        const manufactureDateInput = document.getElementById("manufactureDate");

        if (statusInput.value === "Expired") {
            // Check if manufacture date is empty return false
            if (manufactureDateInput.value === "") {
                statusInput.setCustomValidity(
                    "Please enter a manufacture date before setting status to 'Expired'"
                );
                statusFeedback.textContent =
                    "Please enter a manufacture date before setting status to 'Expired'";
                manufactureDateInput.setCustomValidity(
                    "Please enter a manufacture date before setting status to 'Expired'"
                );
                document.getElementById(
                    "addManufactureDateFeedback"
                ).textContent =
                    "Please enter a manufacture date before setting status to 'Expired'";
                return false;
            }
            // Get manufacture date and calculate expire date (manufacture date + 5 years)
            const manufactureDate =
                document.getElementById("manufactureDate").value;
            const expireDate = new Date(manufactureDate);
            expireDate.setFullYear(expireDate.getFullYear() + 5);
            console.log("Calculated Expire Date:", expireDate);

            // Get the current date and set its time to midnight for accurate comparison
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            console.log("Current Date:", currentDate);

            // If expireDate is in the future, set custom validity error
            if (expireDate > currentDate) {
                statusInput.setCustomValidity(
                    "Device status is 'Expired' but the expire date (manufacture date + 5 years) is in the future."
                );
                statusFeedback.textContent =
                    "Device status is 'Expired' but the expire date (manufacture date + 5 years) is in the future.";
                manufactureDateInput.setCustomValidity(
                    "Manufacture date cannot be within the past 5 years if status is 'Expired'"
                );
                document.getElementById(
                    "addManufactureDateFeedback"
                ).textContent =
                    "Manufacture date cannot be within the past 5 years if status is 'Expired'";

                return false;
            }

            // Clear any previous custom validity message if status is correctly "Expired"
            statusInput.setCustomValidity("");
            statusFeedback.textContent = "";
            manufactureDateInput.setCustomValidity("");
            document.getElementById("addManufactureDateFeedback").textContent =
                "";
            return true;
        }

        // Clear any previous custom validity message if status is not "Expired"
        statusInput.setCustomValidity("");
        statusFeedback.textContent = "";
        manufactureDateInput.setCustomValidity("");
        document.getElementById("addManufactureDateFeedback").textContent = "";
        return true;
    }

    // Add event listener to the add device button
    addDeviceButton.addEventListener("click", function (event) {
        // Validate all select elements before form submission
        document
            .querySelectorAll(
                ".emergencyDeviceTypeInput, .siteInput, .buildingInput, .roomInput"
            )
            .forEach((select) => {
                validateSelect(select);
            });

        // Validate description length
        validateLength(description, 255);

        // Validate status
        const statusValid = validateAddStatus();

        if (!addDeviceForm.checkValidity() || !statusValid) {
            event.preventDefault();
            event.stopPropagation();
        } else {
            // If the form is valid, submit it
            addDeviceForm.submit();
        }

        addDeviceForm.classList.add("was-validated");
    });

    // Add event listener to the edit device button
    editDeviceButton.addEventListener("click", function (event) {
        event.preventDefault(); // Prevent default form submission

        // Validate all select elements before form submission
        document
            .querySelectorAll(
                ".emergencyDeviceTypeInput, .editSiteInput, .editBuildingInput, .roomInput"
            )
            .forEach((select) => {
                validateSelect(select);
            });

        // Validate description length
        validateLength(description, 255);

        // Validate status
        const statusValid = validateEditStatus();

        // Check if the form is valid
        if (!editDeviceForm.checkValidity() || !statusValid) {
            event.stopPropagation();
            editDeviceForm.classList.add("was-validated");
        } else {
            // Inside the form submission logic
            if (document.getElementById("editStatusInput").disabled) {
                document.getElementById("editStatusInput").disabled = false; // Temporarily enable
            }
            // If the form is valid, prepare to send the PUT request
            const formData = new FormData(editDeviceForm);
            const jsonData = {};
            for (const [key, value] of formData.entries()) {
                jsonData[key] = value;
            }
            console.log(jsonData);
            // Send the PUT request
            fetch(
                `/api/emergency-device/${
                    document.getElementById("editDeviceID").value
                }`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(jsonData),
                }
            )
                .then((response) => response.json())
                .then((data) => {
                    console.log("Success:", data);
                    if (data.error) {
                        window.location.href = data.redirectURL;
                    } else if (data.message) {
                        window.location.href = data.redirectURL;
                    } else {
                        console.error("Unexpected response:", data);
                        // Handle unexpected responses (e.g., show an error message)
                        throw new Error("Unexpected response");
                    }
                })
                .catch((error) => {
                    console.error("Fetch error:", error);
                    // Optionally display a user-friendly error message
                });
        }
    });
});

export function viewDeviceInspections(deviceId) {
    // Close the notification modal if open
    $("#notificationsModal").modal("hide");

    console.log(`Inspect device with ID: ${deviceId}`);

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
            // log the data to the console
            console.log(data);

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

export function viewInspectionDetails(inspectionId) {
    console.log(`View inspection details for inspection ID: ${inspectionId}`);
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

console.log("User ID:", user_id);

export function addInspection() {
    const deviceId = document.getElementById("inspect_device_id").value;

    // Set the user ID in the hidden input field
    document.getElementById("inspect_user_id").value = user_id;

    console.log(`Adding inspection for device ID: ${deviceId}`);

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

    console.log(`Device ID set in form: ${deviceIdInput.value}`);

    // Show the add inspection modal
    $("#addInspectionModal").modal("show");
}

document.addEventListener("DOMContentLoaded", function () {
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
    const inspectionStatusFeedback = inspectionStatus.nextElementSibling;

    // Ensure the elements are found
    if (
        !addInspectionButton ||
        !addInspectionForm ||
        !inspectionDateTimeInput ||
        !inspectionStatus
    ) {
        console.error("Required elements not found in the DOM.");
        return;
    }

    // Get all checkboxes except workOrderRequired and isReplaced
    const checkboxes = Array.from(
        addInspectionForm.querySelectorAll('input[type="checkbox"]')
    ).filter(
        (checkbox) => !["workOrderRequired", "isReplaced"].includes(checkbox.id)
    );

    // Function to validate checkboxes based on inspection status
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

    // Add event listener to inspection status dropdown
    inspectionStatus.addEventListener("change", function () {
        validateInspectionStatus();
        // Show validation message immediately on change
        if (addInspectionForm.classList.contains("was-validated")) {
            inspectionStatusFeedback.style.display = this.validationMessage
                ? "block"
                : "none";
            inspectionStatusFeedback.textContent = this.validationMessage || "";
        }
    });

    // Add change event listeners to all checkboxes
    checkboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            if (inspectionStatus.value === "Passed") {
                validateInspectionStatus();
                // Update status feedback if form is already validated
                if (addInspectionForm.classList.contains("was-validated")) {
                    inspectionStatusFeedback.style.display =
                        inspectionStatus.validationMessage ? "block" : "none";
                    inspectionStatusFeedback.textContent =
                        inspectionStatus.validationMessage;
                }
            }
        });
    });

    // Event listener for inspection date input change
    inspectionDateTimeInput.addEventListener("input", function () {
        // Get the current local date and time
        const currentDateTime = new Date(); // Current date and time in local time
        console.log(
            "Current Local Date and Time:",
            currentDateTime.toISOString()
        );
        console.log("Input Date and Time:", inspectionDateTimeInput.value);

        // Create a Date object from the input value
        const inputDateTime = new Date(inspectionDateTimeInput.value);

        // Check if the input date and time is valid
        if (inputDateTime) {
            // Check if the inspection date and time is in the future
            if (inputDateTime > currentDateTime) {
                inspectionDateTimeInput.setCustomValidity(
                    "Inspection date and time cannot be in the future"
                );
                inspectionDateFeedback.textContent =
                    "Inspection date and time cannot be in the future";
            } else {
                inspectionDateTimeInput.setCustomValidity(""); // Clear any previous validity message
                inspectionDateFeedback.textContent = ""; // Clear feedback message
            }
        } else {
            inspectionDateTimeInput.setCustomValidity(
                "Please provide a valid inspection date and time"
            );
            inspectionDateFeedback.textContent =
                "Please provide a valid inspection date and time";
        }
    });

    // Add event listener to the add inspection button
    addInspectionButton.addEventListener("click", function (event) {
        event.preventDefault(); // Prevent default form submission

        // Check if inspection date and time are provided
        if (inspectionDateTimeInput.value) {
            // Get the current local date and time
            const currentDateTime = new Date(); // Current date and time in local time
            console.log(
                "Current Local Date and Time:",
                currentDateTime.toISOString()
            );
            console.log("Input Date and Time:", inspectionDateTimeInput.value);

            // Create a Date object from the input value
            const inputDateTime = new Date(inspectionDateTimeInput.value);

            // Check if the inspection date and time is in the future
            if (inputDateTime > currentDateTime) {
                inspectionDateTimeInput.setCustomValidity(
                    "Inspection date and time cannot be in the future"
                );
                inspectionDateFeedback.textContent =
                    "Inspection date and time cannot be in the future";
            } else {
                inspectionDateTimeInput.setCustomValidity(""); // Clear any previous validity message
                inspectionDateFeedback.textContent = ""; // Clear feedback message
            }
        } else {
            inspectionDateTimeInput.setCustomValidity(
                "Please provide an inspection date and time"
            );
            inspectionDateFeedback.textContent =
                "Please provide an inspection date and time";
        }

        // Validate inspection status
        validateInspectionStatus();

        // Add was-validated class before checking validity
        addInspectionForm.classList.add("was-validated");

        // Validate the form before submission
        if (!addInspectionForm.checkValidity()) {
            event.stopPropagation();

            // Show custom error messages for invalid fields
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
            // If the form is valid, submit it
            addInspectionForm.submit();
        }
    });
});

export function deviceNotes(description) {
    // Populate the modal with the description
    document.getElementById("notesModalBody").innerText = description;

    // Show the modal
    $("#notesModal").modal("show");
}

// Function to toggle the map visibility
export function toggleMap() {
    var map = document.getElementById("map");
    var deviceList = document.querySelector(".device-list");

    // Check if the map is currently visible
    if (map.classList.contains("d-none")) {
        // Map is hidden, show the map and set device list back to col-xxl-9 width
        map.classList.remove("d-none");
        map.classList.add("col-xxl-3");
        deviceList.classList.remove("col-xxl-12");
        deviceList.classList.add("col-xxl-9");
    } else {
        // Map is visible, hide the map and make device list 100% width
        map.classList.add("d-none");
        deviceList.classList.remove("col-xxl-9");
        deviceList.classList.add("col-xxl-12");
    }
}

export async function searchDevices() {
    const siteFilter = document.getElementById("siteFilter");
    const searchInput = document.getElementById("searchInput");
    const searchValue = searchInput.value.toLowerCase();

    // If site filter is "All Sites", load all devices
    if (siteFilter.selectedOptions[0].text === "All Sites") {
        await loadDevicesAndUpdateTable();
    } else {
        // Reload devices for the selected site
        await loadDevicesAndUpdateTable("", siteFilter.value);
    }

    // Filter allDevices and update filteredDevices
    filteredDevices = allDevices.filter((device) => {
        const baseSearch =
            device.emergency_device_type_name
                .toLowerCase()
                .includes(searchValue) ||
            device.extinguisher_type_name.String.toLowerCase().includes(
                searchValue
            ) ||
            device.room_code.toLowerCase().includes(searchValue) ||
            device.serial_number.String.toLowerCase().includes(searchValue) ||
            device.manufacture_date.Time.toLowerCase().includes(searchValue) ||
            device.expire_date.Time.toLowerCase().includes(searchValue) ||
            device.size.String.toLowerCase().includes(searchValue) ||
            device.status.String.toLowerCase().includes(searchValue) ||
            device.description.String.toLowerCase().includes(searchValue);

        // Add admin-only fields if user is admin
        if (role === "Admin") {
            const lastInspectionFormatted = new Date(
                device.last_inspection_datetime.Time
            )
                .toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                })
                .toLowerCase();

            const nextInspectionFormatted = new Date(
                device.next_inspection_date.Time
            )
                .toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                })
                .toLowerCase();

            return (
                baseSearch ||
                lastInspectionFormatted.includes(searchValue) ||
                nextInspectionFormatted.includes(searchValue)
            );
        }

        return baseSearch;
    });

    updateTable(); // Call updateTable after filtering
}

document.getElementById("searchInput").addEventListener("input", () => {
    searchDevices();
});

// Function to limit the date input to yesterday's date
$(function () {
    var dtToday = new Date();

    // Subtract one day to get yesterday's date
    dtToday.setDate(dtToday.getDate() - 1);

    var month = dtToday.getMonth() + 1;
    var day = dtToday.getDate();
    var year = dtToday.getFullYear();

    // Pad month and day with leading zeros if necessary
    if (month < 10) month = "0" + month.toString();
    if (day < 10) day = "0" + day.toString();

    var maxDate = year + "-" + month + "-" + day;

    // Set max attribute for the date inputs
    $("#editManufactureDateInput").attr("max", maxDate);
    $("#manufactureDate").attr("max", maxDate);
});

// Make functions available globally
window.clearFilters = clearFilters;
window.addDevice = addDevice;
window.editDevice = editDevice;
window.viewDeviceInspections = viewDeviceInspections;
window.viewInspectionDetails = viewInspectionDetails;
window.addInspection = addInspection;
window.deviceNotes = deviceNotes;
window.toggleMap = toggleMap;
