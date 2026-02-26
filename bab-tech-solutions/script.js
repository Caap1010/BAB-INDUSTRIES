const CONTACT_EMAIL = "brokenaintbad@gmail.com";
const CONTACT_WHATSAPP = "067 784 4577";
const CONTACT_WHATSAPP_INTL = "27677844577";

const products = [
    {
        id: 1,
        name: "Galaxy S24 Ultra",
        category: "smartphones",
        brand: "Samsung",
        price: 28999,
        oldPrice: 31999,
        rating: 4.9,
        reviews: 482,
        stock: 18,
        image: "https://source.unsplash.com/640x420/?samsung,smartphone",
        quality: ["Original", "Certified"],
        featured: true,
    },
    {
        id: 2,
        name: "iPhone 15 Pro",
        category: "smartphones",
        brand: "Apple",
        price: 26999,
        oldPrice: 29999,
        rating: 4.8,
        reviews: 530,
        stock: 9,
        image: "https://source.unsplash.com/640x420/?iphone,smartphone",
        quality: ["Original", "Certified"],
        featured: true,
    },
    {
        id: 3,
        name: "Redmi Note 13",
        category: "smartphones",
        brand: "Xiaomi",
        price: 13999,
        oldPrice: 15999,
        rating: 4.5,
        reviews: 310,
        stock: 32,
        image: "https://source.unsplash.com/640x420/?xiaomi,phone",
        quality: ["Original", "Grade A"],
        featured: false,
    },
    {
        id: 4,
        name: "Refurbished iPhone 12",
        category: "smartphones",
        brand: "Apple",
        price: 6499,
        oldPrice: 7999,
        rating: 4.4,
        reviews: 221,
        stock: 7,
        image: "https://source.unsplash.com/640x420/?refurbished,iphone",
        quality: ["Certified", "Grade A"],
        featured: false,
    },
    {
        id: 5,
        name: "65W GaN Fast Charger",
        category: "accessories",
        brand: "Anker",
        price: 999,
        oldPrice: 1299,
        rating: 4.7,
        reviews: 158,
        stock: 50,
        image: "https://source.unsplash.com/640x420/?phone,charger",
        quality: ["Original"],
        featured: true,
    },
    {
        id: 6,
        name: "20,000mAh Power Bank",
        category: "accessories",
        brand: "Baseus",
        price: 999,
        oldPrice: 1299,
        rating: 4.6,
        reviews: 194,
        stock: 41,
        image: "https://source.unsplash.com/640x420/?powerbank,charging",
        quality: ["Original"],
        featured: false,
    },
    {
        id: 7,
        name: "Hydrogel Privacy Protector",
        category: "accessories",
        brand: "Spigen",
        price: 379,
        oldPrice: 499,
        rating: 4.3,
        reviews: 96,
        stock: 66,
        image: "https://source.unsplash.com/640x420/?screen,protector,phone",
        quality: ["Grade A"],
        featured: false,
    },
    {
        id: 8,
        name: "Business Laptop 14” i7",
        category: "computers-tablets",
        brand: "Lenovo",
        price: 18999,
        oldPrice: 22999,
        rating: 4.7,
        reviews: 134,
        stock: 15,
        image: "https://source.unsplash.com/640x420/?business,laptop",
        quality: ["Original", "Certified"],
        featured: true,
    },
    {
        id: 9,
        name: "Gaming Laptop RTX Series",
        category: "computers-tablets",
        brand: "ASUS",
        price: 14999,
        oldPrice: 17999,
        rating: 4.8,
        reviews: 112,
        stock: 6,
        image: "https://source.unsplash.com/640x420/?gaming,laptop,keyboard",
        quality: ["Original", "Certified"],
        featured: true,
    },
    {
        id: 10,
        name: "iPad 10th Gen",
        category: "computers-tablets",
        brand: "Apple",
        price: 9599,
        oldPrice: 10999,
        rating: 4.7,
        reviews: 281,
        stock: 11,
        image: "https://source.unsplash.com/640x420/?tablet,ipad",
        quality: ["Original"],
        featured: false,
    },
    {
        id: 11,
        name: "55” QLED Smart TV",
        category: "tv-entertainment",
        brand: "Samsung",
        price: 7999,
        oldPrice: 9999,
        rating: 4.6,
        reviews: 88,
        stock: 10,
        image: "https://source.unsplash.com/640x420/?smart,tv,livingroom",
        quality: ["Original", "Certified"],
        featured: true,
    },
    {
        id: 12,
        name: "Dolby Atmos Soundbar",
        category: "tv-entertainment",
        brand: "JBL",
        price: 7999,
        oldPrice: 9999,
        rating: 4.5,
        reviews: 73,
        stock: 13,
        image: "https://source.unsplash.com/640x420/?soundbar,home,theater",
        quality: ["Original"],
        featured: false,
    },
    {
        id: 13,
        name: "OLED TV 65”",
        category: "tv-entertainment",
        brand: "LG",
        price: 35999,
        oldPrice: 42999,
        rating: 4.9,
        reviews: 55,
        stock: 4,
        image: "https://source.unsplash.com/640x420/?oled,tv",
        quality: ["Original", "Certified"],
        featured: true,
    },
    {
        id: 14,
        name: "Premium Phone Display",
        category: "repair-parts",
        brand: "OEM",
        price: 3999,
        oldPrice: 4999,
        rating: 4.4,
        reviews: 68,
        stock: 28,
        image: "https://source.unsplash.com/640x420/?phone,screen,repair",
        quality: ["Grade A", "Certified"],
        featured: false,
    },
    {
        id: 15,
        name: "Laptop Keyboard Replacement",
        category: "repair-parts",
        brand: "OEM",
        price: 899,
        oldPrice: 1199,
        rating: 4.3,
        reviews: 41,
        stock: 21,
        image: "https://source.unsplash.com/640x420/?laptop,keyboard,repair",
        quality: ["Grade A"],
        featured: false,
    },
    {
        id: 16,
        name: "PlayStation 5 Console",
        category: "gaming",
        brand: "Sony",
        price: 13999,
        oldPrice: 15999,
        rating: 4.9,
        reviews: 333,
        stock: 8,
        image: "https://source.unsplash.com/640x420/?playstation,console,gaming",
        quality: ["Original", "Certified"],
        featured: true,
    },
    {
        id: 17,
        name: "Pro Gaming Headset",
        category: "gaming",
        brand: "Razer",
        price: 3699,
        oldPrice: 4499,
        rating: 4.6,
        reviews: 144,
        stock: 16,
        image: "https://source.unsplash.com/640x420/?gaming,headset",
        quality: ["Original"],
        featured: false,
    },
    {
        id: 18,
        name: "Ergo Gaming Chair",
        category: "gaming",
        brand: "DXRacer",
        price: 1799,
        oldPrice: 2499,
        rating: 4.4,
        reviews: 89,
        stock: 5,
        image: "https://source.unsplash.com/640x420/?gaming,chair",
        quality: ["Grade A"],
        featured: false,
    },
];

const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const brandFilter = document.getElementById("brandFilter");
const priceFilter = document.getElementById("priceFilter");
const sortFilter = document.getElementById("sortFilter");
const resultsCount = document.getElementById("resultsCount");
const recommendationText = document.getElementById("recommendationText");
const compareStatus = document.getElementById("compareStatus");
const clearCompareBtn = document.getElementById("clearCompareBtn");
const dealTimer = document.getElementById("dealTimer");

const cartSummary = document.getElementById("cartSummary");
const orderEmailBtn = document.getElementById("orderEmailBtn");
const orderWhatsappBtn = document.getElementById("orderWhatsappBtn");
const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerEmail = document.getElementById("customerEmail");
const customerNotes = document.getElementById("customerNotes");
const accountBtn = document.getElementById("accountBtn");

const compared = new Set();
const cart = new Map();

function currency(value) {
    return `R${value.toLocaleString("en-ZA")}`;
}

function stars(rating) {
    const full = "★".repeat(Math.floor(rating));
    const empty = "☆".repeat(5 - Math.floor(rating));
    return `${full}${empty}`;
}

function fillBrandFilter() {
    const brands = [...new Set(products.map((item) => item.brand))].sort();
    for (const brand of brands) {
        const option = document.createElement("option");
        option.value = brand;
        option.textContent = brand;
        brandFilter.append(option);
    }
}

function inPriceRange(price, range) {
    if (range === "all") return true;
    const [min, max] = range.split("-").map(Number);
    return price >= min && price <= max;
}

function getFilteredProducts() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;
    const selectedBrand = brandFilter.value;
    const selectedPrice = priceFilter.value;
    const selectedSort = sortFilter.value;

    let list = products.filter((item) => {
        const textMatch =
            item.name.toLowerCase().includes(query) ||
            item.brand.toLowerCase().includes(query) ||
            item.quality.join(" ").toLowerCase().includes(query);
        const categoryMatch = selectedCategory === "all" || item.category === selectedCategory;
        const brandMatch = selectedBrand === "all" || item.brand === selectedBrand;
        const priceMatch = inPriceRange(item.price, selectedPrice);

        return textMatch && categoryMatch && brandMatch && priceMatch;
    });

    if (selectedSort === "price-asc") {
        list.sort((a, b) => a.price - b.price);
    } else if (selectedSort === "price-desc") {
        list.sort((a, b) => b.price - a.price);
    } else if (selectedSort === "rating-desc") {
        list.sort((a, b) => b.rating - a.rating);
    } else {
        list.sort((a, b) => Number(b.featured) - Number(a.featured));
    }

    return list;
}

function getCartTotal() {
    let total = 0;
    for (const [id, quantity] of cart.entries()) {
        const product = products.find((item) => item.id === id);
        if (product) {
            total += product.price * quantity;
        }
    }
    return total;
}

function buildOrderMessage() {
    const lines = [];
    lines.push("New BAB Tech Solutions Order");
    lines.push("");

    for (const [id, quantity] of cart.entries()) {
        const product = products.find((item) => item.id === id);
        if (product) {
            lines.push(`- ${product.name} x${quantity} (${currency(product.price)} each)`);
        }
    }

    lines.push("");
    lines.push(`Estimated total: ${currency(getCartTotal())}`);
    lines.push("");
    lines.push(`Customer Name: ${customerName.value.trim() || "Not provided"}`);
    lines.push(`Customer Phone: ${customerPhone.value.trim() || "Not provided"}`);
    lines.push(`Customer Email: ${customerEmail.value.trim() || "Not provided"}`);
    lines.push(`Notes: ${customerNotes.value.trim() || "None"}`);
    lines.push("");
    lines.push(`Please confirm this order on WhatsApp ${CONTACT_WHATSAPP}.`);

    return lines.join("\n");
}

function updateOrderLinks() {
    const hasItems = cart.size > 0;

    if (!hasItems) {
        orderEmailBtn.href = "#";
        orderWhatsappBtn.href = "#";
        orderEmailBtn.classList.add("is-disabled");
        orderWhatsappBtn.classList.add("is-disabled");
        return;
    }

    const subject = encodeURIComponent("New BAB Tech Solutions Order");
    const body = encodeURIComponent(buildOrderMessage());

    orderEmailBtn.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    orderWhatsappBtn.href = `https://wa.me/${CONTACT_WHATSAPP_INTL}?text=${body}`;
    orderEmailBtn.classList.remove("is-disabled");
    orderWhatsappBtn.classList.remove("is-disabled");
}

function renderCartSummary() {
    if (!cart.size) {
        cartSummary.innerHTML = "<strong>Cart is empty.</strong> Add products to activate direct order buttons.";
        updateOrderLinks();
        return;
    }

    const items = [];
    for (const [id, quantity] of cart.entries()) {
        const product = products.find((item) => item.id === id);
        if (product) {
            items.push(`<li>${product.name} x${quantity} • ${currency(product.price * quantity)}</li>`);
        }
    }

    cartSummary.innerHTML = `
        <strong>Current Order Summary</strong>
        <ul>${items.join("")}</ul>
        <p><strong>Estimated Total:</strong> ${currency(getCartTotal())}</p>
    `;

    updateOrderLinks();
}

function addToCart(id) {
    const current = cart.get(id) || 0;
    cart.set(id, current + 1);
    renderCartSummary();
}

function renderProducts() {
    const list = getFilteredProducts();
    resultsCount.textContent = `Showing ${list.length} product${list.length === 1 ? "" : "s"}`;

    if (!list.length) {
        productGrid.innerHTML = '<p class="empty">No products found. Try another search or filter.</p>';
        recommendationText.textContent = "Tip: clear one filter to discover more options.";
        return;
    }

    const topChoice = [...list].sort((a, b) => b.rating - a.rating)[0];
    recommendationText.textContent = `Recommended for you: ${topChoice.name} (${topChoice.brand}) • ${topChoice.rating}★`;

    productGrid.innerHTML = list
        .map((item) => {
            const lowStock = item.stock < 10;
            const compareActive = compared.has(item.id);
            const inCart = cart.get(item.id) || 0;

            return `
        <article class="product-card">
          <img class="product-image" src="${item.image}" alt="${item.name}" loading="lazy" />
          <div class="card-top">
            <span class="chip">${item.category.replace("-", " ")}</span>
            <span class="stock ${lowStock ? "low" : "in"}">${lowStock ? "Low Stock" : "In Stock"}</span>
          </div>

          <h3>${item.name}</h3>
          <p class="meta">${item.brand} • ${item.reviews} verified reviews</p>
          <p class="rating">${stars(item.rating)} ${item.rating}</p>

          <div class="price-row">
            <p class="price">${currency(item.price)}</p>
            <p class="old-price">${currency(item.oldPrice)}</p>
          </div>

          <div class="badges">
            ${item.quality.map((badge) => `<span>${badge}</span>`).join("")}
          </div>

          <div class="card-actions">
            <button class="button small add-cart-btn" data-id="${item.id}">${inCart ? `Add More (${inCart})` : "Add to Cart"}</button>
            <button class="button small outline compare-btn" data-id="${item.id}">${compareActive ? "Selected" : "Compare"}</button>
          </div>
        </article>
      `;
        })
        .join("");

    document.querySelectorAll(".compare-btn").forEach((button) => {
        button.addEventListener("click", () => toggleCompare(Number(button.dataset.id)));
    });

    document.querySelectorAll(".add-cart-btn").forEach((button) => {
        button.addEventListener("click", () => addToCart(Number(button.dataset.id)));
    });
}

function toggleCompare(id) {
    if (compared.has(id)) {
        compared.delete(id);
    } else {
        if (compared.size >= 2) {
            compareStatus.textContent = "You can compare up to 2 products at a time.";
            return;
        }
        compared.add(id);
    }

    updateCompareStatus();
    renderProducts();
}

function updateCompareStatus() {
    const selected = products.filter((item) => compared.has(item.id));
    if (!selected.length) {
        compareStatus.textContent = "Select up to 2 products to compare.";
        return;
    }

    if (selected.length === 1) {
        compareStatus.textContent = `Comparing: ${selected[0].name}. Add one more product.`;
        return;
    }

    const [first, second] = selected;
    const betterPrice = first.price <= second.price ? first.name : second.name;
    const betterRating = first.rating >= second.rating ? first.name : second.name;
    compareStatus.textContent = `${first.name} vs ${second.name} • Best price: ${betterPrice} • Best rating: ${betterRating}`;
}

function startDealTimer() {
    let totalSeconds = 4 * 60 * 60;

    setInterval(() => {
        totalSeconds = totalSeconds > 0 ? totalSeconds - 1 : 4 * 60 * 60;

        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        dealTimer.textContent = `Flash Sale ends in ${hours}:${minutes}:${seconds}`;
    }, 1000);
}

function bindEvents() {
    [searchInput, categoryFilter, brandFilter, priceFilter, sortFilter].forEach((element) => {
        element.addEventListener("input", renderProducts);
        element.addEventListener("change", renderProducts);
    });

    [customerName, customerPhone, customerEmail, customerNotes].forEach((element) => {
        element.addEventListener("input", updateOrderLinks);
    });

    clearCompareBtn.addEventListener("click", () => {
        compared.clear();
        updateCompareStatus();
        renderProducts();
    });

    accountBtn.addEventListener("click", () => {
        document.getElementById("checkout").scrollIntoView({ behavior: "smooth" });
    });
}

function init() {
    fillBrandFilter();
    bindEvents();
    renderProducts();
    renderCartSummary();
    updateCompareStatus();
    startDealTimer();
    document.getElementById("year").textContent = new Date().getFullYear();
}

init();
