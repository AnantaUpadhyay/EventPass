const universities = require("./universities.json");
const tracks = ["Tech", "Humanities", "Commerce", "Medicine", "Culture", "Sports", "Interdisciplinary"];
const university = id => universities.find(item => item.id === id);
module.exports = { universities, tracks, university };
