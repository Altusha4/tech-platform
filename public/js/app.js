const postsContainer = document.getElementById("posts");
const publishBtn = document.getElementById("publishBtn");

const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");

// load posts
async function loadPosts() {
    const res = await fetch("/api/content");
    const posts = await res.json();

    postsContainer.innerHTML = "";

    posts.forEach(post => {
        const div = document.createElement("div");
        div.className = "post";

        div.innerHTML = `
            <h3>${post.title}</h3>
            <p>${post.description || post.preview || post.body || ""}</p>
        `;

        postsContainer.appendChild(div);
    });
}

// create post
publishBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title || !description) {
        alert("Fill all fields");
        return;
    }

    await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description })
    });

    titleInput.value = "";
    descriptionInput.value = "";

    loadPosts();
});

// init
loadPosts();
