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

  if (car) {
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

    carDetail.innerHTML = `
      <div class="detail-image-wrapper">
        <img class="detail-image" src="${galleryImages[0]}" alt="${car.title}">
      </div>
      <div class="detail-content">
        <h2 class="detail-title">${car.title}</h2>
        <div class="detail-price">NT$ ${Number(car.price).toLocaleString()}</div>
        <div class="detail-meta">${car.category}｜${car.region}</div>
        <div class="detail-desc">${car.description}</div>

        <div class="detail-gallery">
          ${galleryImages.map(img => `<img src="${img}" alt="${car.title}">`).join("")}
        </div>
      </div>
    `;

    const lightbox = document.getElementById("lightbox");
    const lightboxImage = document.getElementById("lightboxImage");
    const lightboxClose = document.getElementById("lightboxClose");

    if (lightboxImage) {
      lightboxImage.addEventListener("mousemove", (e) => {
        const rect = lightboxImage.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        lightboxImage.style.transformOrigin = `${x}% ${y}%`;
        lightboxImage.style.transform = "scale(2)";
      });

      lightboxImage.addEventListener("mouseleave", () => {
        lightboxImage.style.transformOrigin = "center center";
        lightboxImage.style.transform = "scale(1)";
      });
    }

    const mainImage = carDetail.querySelector(".detail-image");
    const mainImageWrapper = carDetail.querySelector(".detail-image-wrapper");

    if (mainImage && mainImageWrapper) {
      mainImageWrapper.addEventListener("mousemove", (e) => {
        const rect = mainImageWrapper.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        mainImage.style.transformOrigin = `${x}% ${y}%`;
        mainImage.style.transform = "scale(2)";
      });

      mainImageWrapper.addEventListener("mouseleave", () => {
        mainImage.style.transformOrigin = "center center";
        mainImage.style.transform = "scale(1)";
      });
    }

    const galleryThumbs = carDetail.querySelectorAll(".detail-gallery img");

    if (galleryThumbs.length > 0) {
      galleryThumbs[0].classList.add("active");
    }

    galleryThumbs.forEach(img => {
      img.addEventListener("click", () => {
        if (mainImage) {
          mainImage.src = img.src;
          mainImage.style.transformOrigin = "center center";
          mainImage.style.transform = "scale(1)";
        }

        galleryThumbs.forEach(item => item.classList.remove("active"));
        img.classList.add("active");
      });
    });

    if (mainImage && lightbox && lightboxImage) {
      mainImage.addEventListener("click", () => {
        lightboxImage.src = mainImage.src;
        lightboxImage.style.transformOrigin = "center center";
        lightboxImage.style.transform = "scale(1)";
        lightbox.classList.add("show");
      });
    }

    if (lightbox && lightboxImage && lightboxClose) {
      lightboxClose.addEventListener("click", () => {
        lightbox.classList.remove("show");
        lightboxImage.src = "";
        lightboxImage.style.transformOrigin = "center center";
        lightboxImage.style.transform = "scale(1)";
      });

      lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox) {
          lightbox.classList.remove("show");
          lightboxImage.src = "";
          lightboxImage.style.transformOrigin = "center center";
          lightboxImage.style.transform = "scale(1)";
        }
      });
    }
  } else {
    carDetail.innerHTML = `
      <div class="detail-content">
        <h2 class="detail-title">找不到這台車</h2>
        <div class="detail-desc">可能已被刪除，或連結有誤。</div>
      </div>
    `;
  }
 });
} 