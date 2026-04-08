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
let filteredCars = [];


// =========================
// 首頁功能
// =========================
let currentPage = 1;
const carsPerPage = 12;
const carList = document.getElementById("carList");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const regionFilter = document.getElementById("regionFilter");
const priceFilter = document.getElementById("priceFilter");

function hidePageLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) {
    loader.classList.add("hide");
  }
}

async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error("取得登入使用者失敗:", error);
    return null;
  }

  return user;
}

function normalizeCarId(carId) {
  return String(carId);
}

async function getFavoriteCarIds() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("favorites")
    .select("car_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("讀取收藏失敗:", error);
    return [];
  }

  return (data || []).map((item) => String(item.car_id));
}

function setFavoriteButtonState(btn, isActive) {
  if (!btn) return;

  btn.classList.toggle("active", isActive);

  if (btn.classList.contains("detail-favorite")) {
    btn.textContent = isActive ? "❤️ 已收藏" : "🤍 收藏";
  } else {
    btn.textContent = isActive ? "❤️" : "🤍";
  }
}

async function toggleFavorite(carId, btn) {
  const user = await getCurrentUser();

  if (!user) {
    alert("請先登入會員再使用收藏功能");
    window.location.href = "login.html";
    return;
  }

  const normalizedCarId = normalizeCarId(carId);

  const { data: existing, error: existingError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("car_id", normalizedCarId)
    .maybeSingle();

  if (existingError) {
    console.error("檢查收藏狀態失敗:", existingError);
    alert("收藏功能發生錯誤，請稍後再試");
    return;
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      console.error("取消收藏失敗:", deleteError);
      alert("取消收藏失敗，請稍後再試");
      return;
    }

    setFavoriteButtonState(btn, false);
  } else {
    const { error: insertError } = await supabase
      .from("favorites")
      .insert({
        user_id: user.id,
        car_id: normalizedCarId
      });

    if (insertError) {
      console.error("加入收藏失敗:", insertError);
      alert("加入收藏失敗，請稍後再試");
      return;
    }

    setFavoriteButtonState(btn, true);
  }
}

async function setupFavoriteButtons() {
  const buttons = document.querySelectorAll(".favorite-btn:not(.detail-favorite)");
  if (buttons.length === 0) return;

  const favoriteIds = await getFavoriteCarIds();

  buttons.forEach((btn) => {
    const carId = normalizeCarId(btn.dataset.id);
    const isActive = favoriteIds.includes(carId);

    setFavoriteButtonState(btn, isActive);

    btn.onclick = null;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(carId, btn);
    });
  });
}

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

  const start = (currentPage - 1) * carsPerPage;
  const end = start + carsPerPage;
  const pageCars = carArray.slice(start, end);

  if (pageCars.length === 0) {
    carList.innerHTML = `<p>目前沒有符合條件的車輛。</p>`;
    return;
  }

  pageCars.forEach(car => {
    const card = document.createElement("div");
    card.className = "car-card";

    card.innerHTML = `
      <button class="favorite-btn" data-id="${car.id}" type="button">🤍</button>

      <a href="detail.html?id=${car.id}" class="car-link">
        <img src="${car.image}" alt="${car.title}">
        <div class="car-content">
          <h2 class="car-title">${car.title}</h2>
          <div class="card-price">NT$ ${Number(car.price).toLocaleString()}</div>
          <div class="car-meta">${car.category}｜${car.region}</div>
        </div>
      </a>
    `;

    carList.appendChild(card);
  });

  setupFavoriteButtons();
  renderPagination(carArray.length);
}

function filterCars() {
  if (!searchInput || !categoryFilter || !regionFilter || !priceFilter) return;

  currentPage = 1;
  
  const keyword = searchInput.value.toLowerCase().trim();
  const selectedCategory = categoryFilter.value;
  const selectedRegion = regionFilter.value;
  const selectedPrice = priceFilter.value;

  filteredCars = cars.filter(car => {
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
    filteredCars = data;
    renderCars(filteredCars);
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
    const brand = document.getElementById("brandInput").value.trim();
    const model = document.getElementById("modelInput").value.trim();
    const year = Number(document.getElementById("yearInput").value);
    const cc = Number(document.getElementById("ccInput").value);

    const price = Number(document.getElementById("priceInput").value);
    const region = document.getElementById("regionInput").value.trim();
    const category = document.getElementById("categoryInput").value.trim();

    const mileage = Number(document.getElementById("mileageInput").value);
    const color = document.getElementById("colorInput").value.trim();

    const imageFiles = document.getElementById("imageInput").files;
    const equipment = document.getElementById("equipmentInput").value.trim();
    const description = document.getElementById("descInput").value.trim();

    if (
      !title ||
      !brand ||
      !model ||
      Number.isNaN(year) ||
      Number.isNaN(cc) ||
      Number.isNaN(price) ||
      !region ||
      !category ||
      !description
    ) {
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
          brand,
          model,
          year,
          cc,
          price,
          region,
          category,
          mileage: Number.isNaN(mileage) ? null : mileage,
          color: color || null,
          description,
          equipment: equipment || null,
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
    document.getElementById("brandInput").value = "";
    document.getElementById("modelInput").value = "";
    document.getElementById("yearInput").value = "";
    document.getElementById("ccInput").value = "";
    document.getElementById("priceInput").value = "";
    document.getElementById("regionInput").value = "";
    document.getElementById("categoryInput").value = "";
    document.getElementById("mileageInput").value = "";
    document.getElementById("colorInput").value = "";
    document.getElementById("imageInput").value = "";
    document.getElementById("equipmentInput").value = "";
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

  loadCarsFromSupabase()
    .then(async (data) => {
      cars = data;

      const car = cars.find(item => item.id === carId);

      if (!car) {
        carDetail.innerHTML = `
          <div class="detail-content">
            <h2 class="detail-title">找不到這台車</h2>
            <div class="detail-desc">可能已被刪除，或連結有誤。</div>
          </div>
        `;
        hidePageLoader();
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
      const equipmentList = car.equipment
        ? car.equipment
            .split("\n")
            .map(item => item.trim())
            .filter(item => item !== "")
        : [];

      carDetail.innerHTML = `
      <div class="detail-container">

        <!-- 左 -->
        <div class="detail-left">
          <div class="detail-image-wrapper carousel">
            <button class="arrow left" id="prevBtn">❮</button>
            <img id="mainImage" src="${galleryImages[0]}" class="detail-main-img">
            <button class="arrow right" id="nextBtn">❯</button>
          </div>

          <div class="thumbnail-row" id="thumbnails">
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

          <div class="car-spec-grid">

            <div class="spec-item">
              <div class="spec-label">廠牌</div>
              <div class="spec-value">${car.brand || "-"}</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">車型</div>
              <div class="spec-value">${car.model || "-"}</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">類型</div>
              <div class="spec-value">${car.category || "-"}</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">排氣量</div>
              <div class="spec-value">${car.cc || "-"} cc</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">顏色</div>
              <div class="spec-value">${car.color || "-"}</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">出廠年份</div>
              <div class="spec-value">${car.year ? `${car.year} 年` : "-"}</div>
            </div>

            <div class="spec-item spec-item-full">
              <div class="spec-label">行駛里程</div>
              <div class="spec-value">
                ${car.mileage ? Number(car.mileage).toLocaleString() + " 公里" : "-"}
              </div>
            </div>

          </div>

          <div class="car-price-row">
            <span class="price-title">售價</span>
            <span class="car-price">${Number(car.price).toLocaleString()}</span>
          </div>

          <div class="detail-action-row">
            <button id="detailFavoriteBtn" class="favorite-btn detail-favorite" type="button" data-id="${car.id}">🤍 收藏</button>
            <button id="contactSellerBtn" class="contact-btn">聯絡賣家</button>
          </div>

          <div class="contact-info" id="contactInfo">
            <p>📞 0912-345-678</p>
            <p>LINE：car_seller</p>
            <p>✉️ seller@example.com</p>
          </div>

        </div>
      </div>
      ${equipmentList.length > 0 ? `
        <div class="equipment-section">
          <div class="equipment-header">
            <span class="equipment-deco"></span>
            <h3>車輛配備</h3>
          </div>

          <div class="equipment-content">
            <div class="equipment-label">重點配備</div>
            <div class="equipment-list">
              ${equipmentList.map(item => `<div class="equipment-item">${item}</div>`).join("")}
            </div>
          </div>
        </div>
      ` : ""}
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

      const detailFavoriteBtn = document.getElementById("detailFavoriteBtn");

      if (detailFavoriteBtn) {
        const favoriteIds = await getFavoriteCarIds();
        const isActive = favoriteIds.includes(normalizeCarId(car.id));
        setFavoriteButtonState(detailFavoriteBtn, isActive);

        detailFavoriteBtn.addEventListener("click", () => {
          toggleFavorite(car.id, detailFavoriteBtn);
        });
      }

      if (contactSellerBtn && contactInfo) {
        contactSellerBtn.addEventListener("click", () => {
          contactInfo.style.display =
            contactInfo.style.display === "block" ? "none" : "block";
        });
      }

      hidePageLoader();
    })
    .catch((error) => {
      console.error("詳細頁載入失敗:", error);
      hidePageLoader();
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

function renderPagination(totalCars) {
  let pagination = document.getElementById("pagination");

  if (!pagination) {
    pagination = document.createElement("div");
    pagination.id = "pagination";
    pagination.style.textAlign = "center";
    pagination.style.margin = "30px 0";
    carList.after(pagination);
  }

  const totalPages = Math.ceil(totalCars / carsPerPage);

  pagination.innerHTML = `
    <button id="prevPage" ${currentPage === 1 ? "disabled" : ""}>上一頁</button>
    <span style="margin: 0 10px;">第 ${currentPage} / ${totalPages} 頁</span>
    <button id="nextPage" ${currentPage === totalPages ? "disabled" : ""}>下一頁</button>
  `;

  document.getElementById("prevPage")?.addEventListener("click", () => {
    currentPage--;
    renderCars(filteredCars);
  });

  document.getElementById("nextPage")?.addEventListener("click", () => {
    currentPage++;
    renderCars(filteredCars);
  });
}

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileDrawer = document.getElementById("mobileDrawer");

if (mobileMenuBtn && mobileDrawer) {
  mobileMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileDrawer.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!mobileDrawer.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      mobileDrawer.classList.remove("show");
    }
  });

  mobileDrawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileDrawer.classList.remove("show");
    });
  });
}

async function updateAuthUI() {
  const memberCenterBtn = document.getElementById("memberCenterBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const guestOnlyEls = document.querySelectorAll(".guest-only");
  const userOnlyEls = document.querySelectorAll(".user-only");

  if (!memberCenterBtn || !logoutBtn) return;

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error("取得登入狀態失敗：", error);
    return;
  }

  if (user) {
    guestOnlyEls.forEach((el) => el.classList.add("hidden"));
    userOnlyEls.forEach((el) => el.classList.remove("hidden"));

    memberCenterBtn.textContent = "會員中心";
    memberCenterBtn.href = "member.html";
  } else {
    guestOnlyEls.forEach((el) => el.classList.remove("hidden"));
    userOnlyEls.forEach((el) => el.classList.add("hidden"));
  }

  logoutBtn.addEventListener("click", async () => {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error("登出失敗：", signOutError);
      alert("登出失敗，請稍後再試");
      return;
    }

    window.location.href = "index.html";
  });
}

updateAuthUI();

// 如果在 member.html，沒登入就踢回 login
if (window.location.pathname.includes("member.html")) {
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) {
      alert("請先登入");
      window.location.href = "login.html";
    }
  });
}

const tabs = document.querySelectorAll(".member-sidebar li");
const tabContents = {
  profile: document.getElementById("profileTab"),
  favorites: document.getElementById("favoritesTab"),
  chat: document.getElementById("chatTab")
};

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    Object.values(tabContents).forEach(c => c.classList.remove("active"));
    tabContents[tab.dataset.tab].classList.add("active");
  });
});