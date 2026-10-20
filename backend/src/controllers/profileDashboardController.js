'use strict';

/** Profile / Dashboard Controller - GET /api/profile (FR-11, FR-12), GET /api/dashboard (FR-13). */
const service = require('../services/profileDashboardService');

async function profile(req, res) {
  res.json(await service.getProfile(req.user));
}

async function dashboard(req, res) {
  res.json(await service.getDashboard(req.user));
}

module.exports = { profile, dashboard };
