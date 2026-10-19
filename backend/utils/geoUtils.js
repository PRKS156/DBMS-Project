/**
 * Geodesic and Navigation Utilities for MedRelay
 * Calculates spherical distance, compass bearing, formatting, and ETAs.
 */

const EARTH_RADIUS_METERS = 6371e3;

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 * @param {number} lat1 Latitude of origin point
 * @param {number} lon1 Longitude of origin point
 * @param {number} lat2 Latitude of destination point
 * @param {number} lon2 Longitude of destination point
 * @returns {number} Distance in meters
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * c;
}

/**
 * Formats a metric distance into a human-friendly localized representation.
 * @param {number} meters Distance in meters
 * @param {boolean} isAdmitted Whether the response is within an inpatient hospital ward
 * @returns {string} Formatted distance string
 */
function formatDistance(meters, isAdmitted = false) {
    if (meters === null || meters === undefined || isNaN(meters)) return 'Unknown';
    if (isAdmitted && meters < 100) return 'Within Facility Ward';
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} meters`;
}

/**
 * Estimates the time of arrival (ETA) given a distance and urban transit speed.
 * @param {number} meters Distance in meters
 * @param {boolean} isAdmitted Inpatient hospital response
 * @param {number} avgSpeedKmh Average transit speed in km/h (default: 40 km/h)
 * @returns {string} Formatted ETA string
 */
function formatETA(meters, isAdmitted = false, avgSpeedKmh = 40) {
    if (meters === null || meters === undefined || isNaN(meters)) return 'Calculating...';
    if (isAdmitted || meters < 100) {
        if (meters < 30) return 'Immediate (Same ward)';
        return '~1 - 2 mins (On foot)';
    }
    const minutes = (meters / 1000 / avgSpeedKmh) * 60;
    if (minutes < 1) return 'Less than 1 min';
    if (minutes < 60) return `~${Math.ceil(minutes)} min`;
    return `~${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

/**
 * Calculates initial compass bearing from point A to point B in degrees (0 - 360).
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return ((θ * 180) / Math.PI + 360) % 360;
}

module.exports = {
    getDistance,
    formatDistance,
    formatETA,
    calculateBearing
};
