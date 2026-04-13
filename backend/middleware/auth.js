function fakeAuthGuard(req, res, next) {
    const role = req.headers['x-user-role'];
    const name = req.headers['x-user-name'];

    if (!role) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    req.user = { role, name };
    next();
}
module.exports = { fakeAuthGuard };