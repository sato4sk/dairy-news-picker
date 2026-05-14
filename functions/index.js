/**
 * Main entry point for Cloud Functions.
 * Exports functions from separate modules to keep the code modular and clean.
 */

const { fetchFeeds } = require('./fetchFeeds');
const { triageArticles } = require('./triageArticles');

exports.fetchFeeds = fetchFeeds;
exports.triageArticles = triageArticles;
