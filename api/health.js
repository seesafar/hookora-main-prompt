module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    service: "NoFurMess API",
    project: "Hookora",
    status: "running",
    time: new Date().toISOString()
  });
};
