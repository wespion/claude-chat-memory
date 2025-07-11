module.exports = (req, res) => {
  res.json({ message: 'API Routes working!', timestamp: new Date().toISOString() });
};