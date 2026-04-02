console.log("script.js 有執行");
console.log("目前網址:", window.location.href);
console.log("Supabase client ready");
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sszyqmgrlxpwonfidkcr.supabase.co";
const supabaseKey = "sb_publishable_DxGd6Yu_mXB1YqiUTxJdqA_CT17Rv27";

const supabase = createClient(supabaseUrl, supabaseKey);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

let cars = [];

// =========================
// 首頁功能
// =========================
const carList = document.getElementById("carList");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const regionFilter = document.getElementById("regionFilter");
const priceFilter = document.getElementById("priceFilter");

async function loadCarsFromSupabase() {
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("cars data:", data);
  console.log("cars error:", error);

  if (error) {
    console.error("讀取 cars 失敗:", error);
    return [];
  }

  return data;
}

function renderCars(carArray) {
  if (!carList) return;

  carList.innerHTML = "";

  if (carArray.length === 0) {
    carList.innerHTML = `<p>目前沒有符合條件的車輛。</p>`;
    return;
  }

  carArray.forEach(car => {
    const card = document.createElement("div");
    card.className = "car-card";

   card.innerHTML = `
    <a href="detail.html?id=${car.id}" class="car-link">
      <img src="${car.image}" alt="${car.title}">
      <div class="car-content">
        <h2 class="car-title">${car.title}</h2>
        <div class="car-price">NT$ ${Number(car.price).toLocaleString()}</div>
        <div class="car-meta">${car.category}｜${car.region}</div>
        <div class="car-desc">${car.description}</div>
      </div>
    </a>
  `;

    carList.appendChild(card);
  });
}

function filterCars() {
  if (!searchInput || !categoryFilter || !regionFilter || !priceFilter) return;

  const keyword = searchInput.value.toLowerCase().trim();
  const selectedCategory = categoryFilter.value;
  const selectedRegion = regionFilter.value;
  const selectedPrice = priceFilter.value;

  const filteredCars = cars.filter(car => {
    const matchKeyword = car.title.toLowerCase().includes(keyword);

    const matchCategory =
      selectedCategory === "all" || car.category === selectedCategory;

    const matchRegion =
      selectedRegion === "all" || car.region === selectedRegion;

    let matchPrice = true;
    if (selectedPrice !== "all") {
      const [min, max] = selectedPrice.split("-").map(Number);
      matchPrice = car.price >= min && car.price <= max;
    }

    return matchKeyword && matchCategory && matchRegion && matchPrice;
  });

  renderCars(filteredCars);
}

if (carList) {
  loadCarsFromSupabase().then((data) => {
    cars = data;
    renderCars(cars);
  });
}

if (searchInput && categoryFilter && regionFilter && priceFilter) {
  searchInput.addEventListener("input", filterCars);
  categoryFilter.addEventListener("change", filterCars);
  regionFilter.addEventListener("change", filterCars);
  priceFilter.addEventListener("change", filterCars);
}

// =========================
// 發文頁功能
// =========================
const addCarBtn = document.getElementById("addCarBtn");

if (addCarBtn) {
  addCarBtn.addEventListener("click", async () => {
    const title = document.getElementById("titleInput").value.trim();
    const price = Number(document.getElementById("priceInput").value);
    const region = document.getElementById("regionInput").value.trim();
    const category = document.getElementById("categoryInput").value.trim();
    const imageFiles = document.getElementById("imageInput").files;
    const description = document.getElementById("descInput").value.trim();

    if (!title || Number.isNaN(price) || !region || !category || !description) {
      alert("請把基本欄位填完整");
      return;
    }

    if (imageFiles.length === 0) {
      alert("請至少上傳一張照片");
      return;
    }

    const images = await Promise.all(
      Array.from(imageFiles).map(fileToBase64)
    );

    const { data: insertedCar, error: carError } = await supabase
      .from("cars")
      .insert([
        {
          title,
          price,
          region,
          category,
          description,
          image: images[0]
        }
      ])
      .select()
      .single();

    if (carError) {
      console.error("新增車輛失敗:", carError);
      alert("新增車輛失敗，請看 Console");
      return;
    }

    const imageRows = images.map((img, index) => ({
      car_id: insertedCar.id,
      image_url: img,
      sort_order: index
    }));

    const { error: imagesError } = await supabase
      .from("car_images")
      .insert(imageRows);

    if (imagesError) {
      console.error("新增圖片失敗:", imagesError);
      alert("車輛已新增，但圖片新增失敗，請看 Console");
      return;
    }

    alert("刊登成功！回首頁就能看到新車。");

    document.getElementById("titleInput").value = "";
    document.getElementById("priceInput").value = "";
    document.getElementById("regionInput").value = "";
    document.getElementById("categoryInput").value = "";
    document.getElementById("imageInput").value = "";
    document.getElementById("descInput").value = "";

    window.location.href = "index.html";
  });
}
// =========================
// 詳細頁功能
// =========================
const carDetail = document.getElementById("carDetail");

if (carDetail) {
  const params = new URLSearchParams(window.location.search);
  const carId = Number(params.get("id"));

  loadCarsFromSupabase().then(async (data) => {
    cars = data;

    const car = cars.find(item => item.id === carId);

    if (!car) {
      carDetail.innerHTML = `
        <div class="detail-content">
          <h2 class="detail-title">找不到這台車</h2>
          <div class="detail-desc">可能已被刪除，或連結有誤。</div>
        </div>
      `;
      return;
    }

    const { data: imageData, error: imageError } = await supabase
      .from("car_images")
      .select("*")
      .eq("car_id", car.id)
      .order("sort_order", { ascending: true });

    if (imageError) {
      console.error("讀取 car_images 失敗:", imageError);
    }

    const galleryImages =
      imageData && imageData.length > 0
        ? imageData.map(item => item.image_url)
        : [car.image];

    let currentIndex = 0;

    carDetail.innerHTML = `
    <div class="detail-container">

      <!-- 左 -->
      <div class="detail-left">
        <div class="detail-image-wrapper carousel">
          <button class="arrow left" id="prevBtn">❮</button>
          <img id="mainImage" src="${galleryImages[0]}" class="detail-main-img">
          <button class="arrow right" id="nextBtn">❯</button>
        </div>

        <div class="thumbnail-row">
          ${galleryImages.map((img, index) => `
            <img 
              src="${img}" 
              class="thumb ${index === 0 ? "active" : ""}" 
              data-index="${index}"
            >
          `).join("")}
        </div>
      </div>

      <!-- 右 -->
      <div class="detail-right">

        <h2 class="car-title">${car.title}</h2>

        <div class="car-tags">
          ${car.brand} / ${car.model} / ${car.year}
        </div>

        <div class="car-info">
          <div><span>里程</span>${car.mileage} km</div>
          <div><span>顏色</span>${car.color}</div>
          <div><span>排氣量</span>${car.cc}</div>
        </div>

        <div class="car-price">
          NT$ ${Number(car.price).toLocaleString()}
        </div>

        <button id="contactSellerBtn" class="contact-btn">聯絡賣家</button>

      </div>

    </div>
    `;

    const mainImage = document.getElementById("mainImage");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const thumbs = document.querySelectorAll(".thumb");

    function updateImage() {
      mainImage.src = galleryImages[currentIndex];

      thumbs.forEach(thumb => thumb.classList.remove("active"));
      thumbs[currentIndex].classList.add("active");
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
        updateImage();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % galleryImages.length;
        updateImage();
      });
    }

    thumbs.forEach(thumb => {
      thumb.addEventListener("click", () => {
        currentIndex = Number(thumb.dataset.index);
        updateImage();
      });
    });

    const contactSellerBtn = document.getElementById("contactSellerBtn");
    const contactInfo = document.getElementById("contactInfo");

    if (contactSellerBtn && contactInfo) {
      contactSellerBtn.addEventListener("click", () => {
        contactInfo.style.display =
          contactInfo.style.display === "block" ? "none" : "block";
      });
    }
  });
}
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll("#homeSection, #carSection, #serviceSection, #aboutSection");

function setActiveNav() {
  let currentSectionId = "homeSection"; // ⭐ 預設首頁

  const scrollY = window.scrollY;
  const offset = 120;

  sections.forEach(section => {
    const sectionTop = section.offsetTop - offset;
    const sectionHeight = section.offsetHeight;

    if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
      currentSectionId = section.getAttribute("id");
    }
  });

  navLinks.forEach(link => {
    link.classList.remove("active");

    const href = link.getAttribute("href");
    if (href === `#${currentSectionId}`) {
      link.classList.add("active");
    }
  });
}

window.addEventListener("scroll", setActiveNav);
window.addEventListener("load", setActiveNav);