router.patch("/:id/interests", async (req, res) => {
    try {
        const { interests } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { interests: interests },
            { new: true }
        );
        res.json({ success: true, user: updatedUser });
    } catch (err) {
        res.status(400).json({ error: "Не удалось сохранить интересы" });
    }
});