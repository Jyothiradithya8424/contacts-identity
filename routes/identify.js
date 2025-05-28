const express = require("express");
const router = express.Router();
const { handleContactIdentification } = require("../controllers/contactController");

router.post("/identify", handleContactIdentification);

module.exports = router;