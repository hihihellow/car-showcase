import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

console.log("script.js 有執行");
console.log("目前網址:", window.location.href);
console.log("Supabase client ready");

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
const headerSearchInput = document.getElementById("headerSearchInput");
const mobileSearchBtn = document.getElementById("mobileSearchBtn");
const headerSearch = document.querySelector(".header-search");

if (headerSearchInput && searchInput) {
  headerSearchInput.addEventListener("input", () => {
    searchInput.value = headerSearchInput.value;
    filterCars();
  });
}

if (mobileSearchBtn && headerSearch && headerSearchInput) {
  mobileSearchBtn.addEventListener("click", () => {
    headerSearch.classList.toggle("show");
    if (headerSearch.classList.contains("show")) {
      headerSearchInput.focus();
    }
  });
}

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

  if (window.location.pathname.includes("member.html")) {
    loadFavoriteCars();
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
    .eq("status", "active")
    .order("is_featured", { ascending: false })
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
        ${car.is_featured ? `<div class="featured-badge">精選</div>` : ""}
        <div class="car-content">
          <h2 class="car-title">${car.title}</h2>
          <div class="card-price">NT$ ${Number(car.price).toLocaleString()}</div>
          <div class="car-meta">
            ${car.category || "-"}｜${car.region || "-"}｜${car.year ? car.year + " 年" : "-"}
          </div>
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
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editModeText = document.getElementById("editModeText");

let editingCarId = null;
let oldImages = [];
let selectedImageFiles = [];

const imageInput = document.getElementById("imageInput");
const imagePreviewList = document.getElementById("imagePreviewList");

function renderImagePreview() {
  if (!imagePreviewList) return;

  imagePreviewList.innerHTML = "";

  selectedImageFiles.forEach((file, index) => {
    const imageUrl = URL.createObjectURL(file);

    const item = document.createElement("div");
    item.className = "image-preview-item";

    item.innerHTML = `
      <div class="preview-cover-badge">${index === 0 ? "封面" : `第 ${index + 1} 張`}</div>
      <img src="${imageUrl}" alt="preview">
      <div class="preview-actions">
        <button type="button" class="preview-up-btn" data-index="${index}">上移</button>
        <button type="button" class="preview-down-btn" data-index="${index}">下移</button>
        <button type="button" class="preview-remove-btn" data-index="${index}">刪除</button>
      </div>
    `;

    imagePreviewList.appendChild(item);
  });

  document.querySelectorAll(".preview-up-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      if (index <= 0) return;

      const temp = selectedImageFiles[index - 1];
      selectedImageFiles[index - 1] = selectedImageFiles[index];
      selectedImageFiles[index] = temp;

      renderImagePreview();
    });
  });

  document.querySelectorAll(".preview-down-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      if (index >= selectedImageFiles.length - 1) return;

      const temp = selectedImageFiles[index + 1];
      selectedImageFiles[index + 1] = selectedImageFiles[index];
      selectedImageFiles[index] = temp;

      renderImagePreview();
    });
  });

  document.querySelectorAll(".preview-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      selectedImageFiles.splice(index, 1);
      renderImagePreview();
    });
  });
}

if (imageInput) {
  imageInput.addEventListener("change", () => {
    selectedImageFiles = Array.from(imageInput.files);
    renderImagePreview();
  });
}

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

    if (!editingCarId && selectedImageFiles.length === 0) {
      alert("請至少上傳一張照片");
      return;
    }

    let images = [];

    if (selectedImageFiles.length > 0) {
      for (let i = 0; i < selectedImageFiles.length; i++) {
        const base64 = await fileToBase64(selectedImageFiles[i]);
        images.push(base64);
      }
    } else {
      images = oldImages;
    }

    if (!images || images.length === 0) {
      images = oldImages;
    }
    let savedCar = null;

    if (editingCarId) {
      let updateQuery = supabase
        .from("cars")
        .update({
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
          image: images && images.length > 0 ? images[0] : oldImages[0]
        })
        .eq("id", Number(editingCarId));

      if (isSellerDashboard && currentSellerStore) {
        updateQuery = updateQuery.eq("store_id", currentSellerStore.id);
      }

      const { data: updatedCar, error: updateError } = await updateQuery
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("更新車輛失敗:", updateError);
        alert("更新車輛失敗，請看 Console");
        return;
      }

      if (!updatedCar) {
        alert("更新失敗：找不到這台車，可能已經被刪除，或不是你的車。");
        return;
      }

      savedCar = updatedCar;

      if (selectedImageFiles.length > 0) {
        await supabase
          .from("car_images")
          .delete()
          .eq("car_id", Number(editingCarId));

        const imageRows = images.map((img, index) => ({
          car_id: Number(editingCarId),
          image_url: img,
          sort_order: index
        }));

        const { error: imagesError } = await supabase
          .from("car_images")
          .insert(imageRows);

        if (imagesError) {
          console.error("更新圖片失敗:", imagesError);
      alert("車輛已更新，但圖片更新失敗，請看 Console");
          return;
        }
      }

      alert("車輛更新成功！");
    } else {
      const { data: lastCar, error: adminNoError } = await supabase
        .from("cars")
        .select("admin_no")
        .not("admin_no", "is", null)
        .order("admin_no", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (adminNoError) {
        console.error("取得車號失敗:", adminNoError);
        alert("取得車號失敗，請看 Console");
        return;
      }

      const nextAdminNo = lastCar?.admin_no ? Number(lastCar.admin_no) + 1 : 1;

      let storeId = null;

      if (isSellerDashboard) {
        if (!currentSellerStore) {
          currentSellerStore = await getMyStore();
        }

        if (!currentSellerStore) {
           alert("找不到你的車行資料，無法新增車輛。");
          return;
        }

        storeId = currentSellerStore.id;
      }

      const { data: insertedCar, error: carError } = await supabase
        .from("cars")
        .insert([
          {
            store_id: storeId,
            admin_no: nextAdminNo,
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
            image: images && images.length > 0 ? images[0] : null
          }
        ])
        .select()
        .single();

      if (carError) {
        console.error("新增車輛失敗:", carError);
        alert("新增車輛失敗，請看 Console");
        return;
      }

      savedCar = insertedCar;

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
    }

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
    selectedImageFiles = [];
    renderImagePreview();
    document.getElementById("equipmentInput").value = "";
    document.getElementById("descInput").value = "";

    //window.location.href = "index.html";

    editingCarId = null;
    oldImages = [];

    addCarBtn.textContent = "送出";
    cancelEditBtn.classList.add("hidden");
    editModeText.classList.add("hidden");

    loadAdminCars();
  });
}

// =========================
// ADMIN 車輛列表 + 刪除
// =========================
const adminCarList = document.getElementById("adminCarList");
const adminSearchInput = document.getElementById("adminSearchInput");
const adminStoreFilter = document.getElementById("adminStoreFilter");
const subscriptionLogsList = document.getElementById("subscriptionLogsList");
const adminSectionBtns = document.querySelectorAll(".admin-section-btn");
const adminSections = document.querySelectorAll(".admin-section");

function showAdminSection(sectionName) {
  adminSections.forEach((section) => {
    section.classList.add("hidden");
    section.classList.remove("active");
  });

  adminSectionBtns.forEach((btn) => {
    btn.classList.remove("active");
  });

  const targetSection = document.getElementById(
    sectionName === "cars"
      ? "adminCarsSection"
      : sectionName === "logs"
        ? "adminLogsSection"
        : "adminStatsSection"
  );

  if (targetSection) {
    targetSection.classList.remove("hidden");
    targetSection.classList.add("active");
  }

  document
    .querySelector(`.admin-section-btn[data-section="${sectionName}"]`)
    ?.classList.add("active");

  if (sectionName === "logs") {
    loadSubscriptionLogs();
  }
}

adminSectionBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    showAdminSection(btn.dataset.section);
  });
});

let adminCars = [];
let adminStores = [];
let adminPlans = [];
let currentAdminStatusFilter = "all";

const isSellerDashboard = window.location.pathname.includes("seller-dashboard.html");
let currentSellerStore = null;

async function loadAdminStores() {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("讀取車行失敗:", error);
    adminStores = [];
    return;
  }

  adminStores = data || [];
}

async function loadAdminPlans() {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    console.error("讀取方案失敗:", error);
    adminPlans = [];
    return;
  }

  adminPlans = data || [];
}

async function createSubscriptionLog({
  storeId,
  subscriptionId = null,
  oldPlanId = null,
  newPlanId = null,
  action,
  note = ""
}) {
  const { error } = await supabase
    .from("subscription_logs")
    .insert([
      {
        store_id: storeId,
        subscription_id: subscriptionId,
        old_plan_id: oldPlanId,
        new_plan_id: newPlanId,
        action,
        note
      }
    ]);

  if (error) {
    console.error("寫入方案紀錄失敗:", error);
  }
}

async function loadSubscriptionLogs() {
  if (!subscriptionLogsList) return;

  subscriptionLogsList.innerHTML = "<p>方案紀錄讀取中...</p>";

  await loadAdminStores();
  await loadAdminPlans();

  const { data, error } = await supabase
    .from("subscription_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("讀取方案紀錄失敗:", error);
    subscriptionLogsList.innerHTML = "<p>讀取方案紀錄失敗。</p>";
    return;
  }

  renderSubscriptionLogs(data || []);
}

function renderSubscriptionLogs(logs) {
  if (!subscriptionLogsList) return;

  if (!logs.length) {
    subscriptionLogsList.innerHTML = "<p>目前沒有方案操作紀錄。</p>";
    return;
  }

  subscriptionLogsList.innerHTML = "";

  logs.forEach((log) => {
    const storeName =
      adminStores.find((store) => store.id === log.store_id)?.name || "未知車行";

    const oldPlan =
      adminPlans.find((plan) => plan.id === log.old_plan_id)?.name || "無";

    const newPlan =
      adminPlans.find((plan) => plan.id === log.new_plan_id)?.name || "無";

    const item = document.createElement("div");
    item.className = "subscription-log-item";

    item.innerHTML = `
      <strong>${storeName}</strong>
      <p>操作：${log.action}</p>
      <p>原方案：${oldPlan} → 新方案：${newPlan}</p>
      <p>備註：${log.note || "無"}</p>
      <small>${new Date(log.created_at).toLocaleString("zh-TW")}</small>
    `;

    subscriptionLogsList.appendChild(item);
  });
}

function renderAdminStoreFilter() {
  if (!adminStoreFilter) return;

  adminStoreFilter.innerHTML = `<option value="all">全部車行</option>`;

  adminStores.forEach((store) => {
    const option = document.createElement("option");
    option.value = store.id;
    option.textContent = store.name;
    adminStoreFilter.appendChild(option);
  });
}

async function loadAdminCars() {
  if (!adminCarList) return;

  adminCarList.innerHTML = "<p>車輛讀取中...</p>";

  await loadAdminStores();
  await loadAdminPlans();
  renderAdminStoreFilter();

  let query = supabase
    .from("cars")
    .select("*")
    .order("admin_no", { ascending: true });

  if (isSellerDashboard) {
    currentSellerStore = await getMyStore();

    if (!currentSellerStore) {
      adminCarList.innerHTML = "<p>找不到你的車行資料，請確認你是車行帳號。</p>";
      return;
    }

    query = query.eq("store_id", currentSellerStore.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("讀取後台車輛失敗:", error);
    adminCarList.innerHTML = "<p>讀取車輛失敗，請看 Console。</p>";
    return;
  }

  adminCars = data || [];
  updateAdminStatusCounts();
  applyAdminFilters();
}

function updateAdminStatusCounts() {
  const counts = {
    all: adminCars.length,
    pending_review: adminCars.filter((car) => car.status === "pending_review").length,
    active: adminCars.filter((car) => car.status === "active").length,
    rejected: adminCars.filter((car) => car.status === "rejected").length,
    inactive: adminCars.filter((car) => car.status === "inactive").length
  };

  document.querySelectorAll(".admin-status-tab").forEach((btn) => {
    const status = btn.dataset.status;
    const label = btn.dataset.label || btn.textContent.replace(/\s*\d+$/, "");

    btn.dataset.label = label;
    btn.textContent = `${label} ${counts[status] || 0}`;
  });
}

function applyAdminFilters() {
  const keyword = adminSearchInput
    ? adminSearchInput.value.trim().toLowerCase()
    : "";

  let filtered = [...adminCars];

  if (adminStoreFilter && adminStoreFilter.value !== "all") {
    filtered = filtered.filter((car) => car.store_id === adminStoreFilter.value);
  }

  if (currentAdminStatusFilter !== "all") {
    filtered = filtered.filter((car) => car.status === currentAdminStatusFilter);
  }

  if (keyword) {
    filtered = filtered.filter((car) => {
      return (
        String(car.admin_no || "").includes(keyword) ||
        String(car.title || "").toLowerCase().includes(keyword) ||
        String(car.brand || "").toLowerCase().includes(keyword) ||
        String(car.model || "").toLowerCase().includes(keyword) ||
        String(car.region || "").toLowerCase().includes(keyword) ||
        String(car.category || "").toLowerCase().includes(keyword)
      );
    });
  }

  renderAdminCars(filtered);
}

function renderAdminCars(list) {
  if (!adminCarList) return;

  if (!list || list.length === 0) {
    adminCarList.innerHTML = "<p>找不到符合的車輛。</p>";
    return;
  }

  adminCarList.innerHTML = "";

  list.forEach((car) => {
    const item = document.createElement("div");
    item.className = "admin-car-item";

    item.innerHTML = `
      <img src="${car.image}" alt="${car.title}" class="admin-car-img">

      <div class="admin-car-info">
        <h3>#${car.admin_no || "未編號"}｜${car.title}</h3>
        <p>NT$ ${Number(car.price).toLocaleString()}</p>
        <p>${car.brand || ""} ${car.model || ""}｜${car.category || ""}｜${car.region || ""}</p>
        <p>
          車行：${adminStores.find((store) => store.id === car.store_id)?.name || "平台車輛 / 未指定"}

          ${
            car.store_id
              ? `<button class="view-store-btn" data-store-id="${car.store_id}">查看車行</button>`
              : ""
          }
        </p>
        <p>狀態：${
          car.status === "active"
            ? "上架中"
            : car.status === "pending_review"
              ? "等待審核"
              : car.status === "rejected"
                ? "審核未通過"
                : "已下架"
        }</p>
      </div>

      <div class="admin-action-row">
        <button class="admin-edit-btn" data-id="${car.id}">編輯</button>

        ${
          car.status === "pending_review"
            ? `
              <button class="approve-car-btn" data-id="${car.id}">審核通過</button>
              <button class="reject-car-btn" data-id="${car.id}">退回</button>
            `
            : ""
        }

        <button class="admin-delete-btn" data-id="${car.id}">刪除</button>
      </div>
    `;

    adminCarList.appendChild(item);
  });

  document.querySelectorAll(".admin-edit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await startEditCar(Number(btn.dataset.id));
    });
  });

  document.querySelectorAll(".approve-car-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await approveCar(btn.dataset.id);
    });
  });

  document.querySelectorAll(".reject-car-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await rejectCar(btn.dataset.id);
    });
  });

  document.querySelectorAll(".admin-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = confirm("確定要刪除這台車嗎？刪除後無法復原。");
      if (!ok) return;
      await deleteCar(btn.dataset.id);
    });
  });

  document.querySelectorAll(".view-store-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await viewStoreInfo(btn.dataset.storeId);
    });
  });
}

async function viewStoreInfo(storeId) {
  const store = adminStores.find((item) => String(item.id) === String(storeId));

  if (!store) {
    alert("找不到車行資料");
    return;
  }

  const storeCars = adminCars.filter((car) => String(car.store_id) === String(storeId));

  const activeCount = storeCars.filter((car) => car.status === "active").length;
  const pendingCount = storeCars.filter((car) => car.status === "pending_review").length;
  const rejectedCount = storeCars.filter((car) => car.status === "rejected").length;
  const inactiveCount = storeCars.filter((car) => car.status === "inactive").length;

  const { data: subscription } = await supabase
    .from("seller_subscriptions")
    .select(`
      *,
      plans (*)
    `)
    .eq("store_id", storeId)
    .in("status", ["active", "pending_activation", "inactive"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planName = subscription?.plans?.name || "尚未選擇方案";
  const subStatus =
    subscription?.status === "active"
      ? "使用中"
      : subscription?.status === "inactive"
        ? "已停用"
      : subscription?.status === "pending_activation"
        ? "等待第一台車審核通過"
        : "尚未啟用";

  const expiresText = subscription?.expires_at
    ? new Date(subscription.expires_at).toLocaleDateString("zh-TW")
    : "尚未開始計算";

  const action = prompt(
  `車行名稱：${store.name || "未命名"}

  目前方案：${planName}
  方案狀態：${subStatus}
  到期日：${expiresText}

  請輸入操作：

  1 = 延長 1 個月
  2 = 停用方案
  3 = 重新啟用方案
  4 = 切換方案

  直接取消 = 關閉`
  );

  if (!action) return;

  if (action === "1") {
    await extendSubscription(subscription);
  }

  if (action === "2") {
    await disableSubscription(subscription);
  }

  if (action === "3") {
    await enableSubscription(subscription);
  }

  if (action === "4") {
    await switchSubscriptionPlan(subscription, storeId);
  }
}

async function extendSubscription(subscription) {
  if (!subscription) {
    alert("找不到方案資料");
    return;
  }

  let expiresAt = new Date();

  if (subscription.expires_at) {
    const oldDate = new Date(subscription.expires_at);

    if (oldDate > new Date()) {
      expiresAt = oldDate;
    }
  }

  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const { error } = await supabase
    .from("seller_subscriptions")
    .update({
      expires_at: expiresAt.toISOString(),
      status: "active"
    })
    .eq("id", subscription.id);

  if (error) {
    console.error(error);
    alert("延長方案失敗");
    return;
  }

  await createSubscriptionLog({
    storeId: subscription.store_id,
    subscriptionId: subscription.id,
    oldPlanId: subscription.plan_id,
    newPlanId: subscription.plan_id,
    action: "extend",
    note: "admin 手動延長 1 個月"
  });

  alert("方案已延長 1 個月");
}

async function disableSubscription(subscription) {
  if (!subscription) {
    alert("找不到方案資料");
    return;
  }

  const ok = confirm("確定要停用這個方案嗎？");

  if (!ok) return;

  const { error } = await supabase
    .from("seller_subscriptions")
    .update({
      status: "inactive"
    })
    .eq("id", subscription.id);

  if (error) {
    console.error(error);
    alert("停用失敗");
    return;
  }

  await createSubscriptionLog({
    storeId: subscription.store_id,
    subscriptionId: subscription.id,
    oldPlanId: subscription.plan_id,
    newPlanId: subscription.plan_id,
    action: "disable",
    note: "admin 手動停用方案"
  });

  alert("方案已停用");
}

async function enableSubscription(subscription) {
  if (!subscription) {
    alert("找不到方案資料");
    return;
  }

  const { error } = await supabase
    .from("seller_subscriptions")
    .update({
      status: "active"
    })
    .eq("id", subscription.id);

  if (error) {
    console.error(error);
    alert("重新啟用失敗");
    return;
  }

  await createSubscriptionLog({
    storeId: subscription.store_id,
    subscriptionId: subscription.id,
    oldPlanId: subscription.plan_id,
    newPlanId: subscription.plan_id,
    action: "enable",
    note: "admin 手動重新啟用方案"
  });

  alert("方案已重新啟用");
}

async function switchSubscriptionPlan(subscription, storeId) {
  if (!adminPlans || adminPlans.length === 0) {
    alert("目前沒有可用方案");
    return;
  }

  const planText = adminPlans
    .map((plan) => `${plan.id} = ${plan.name}｜${plan.max_cars} 台｜NT$ ${Number(plan.price).toLocaleString()}`)
    .join("\n");

  const input = prompt(
`請輸入要切換的方案 ID：

${planText}`
  );

  if (!input) return;

  const newPlanId = Number(input);
  const newPlan = adminPlans.find((plan) => Number(plan.id) === newPlanId);

  if (!newPlan) {
    alert("找不到這個方案 ID");
    return;
  }

  const ok = confirm(`確定要切換成「${newPlan.name}」嗎？`);
  if (!ok) return;

  if (!subscription) {
    const { data: newSub, error } = await supabase
      .from("seller_subscriptions")
      .insert([
        {
          store_id: storeId,
          plan_id: newPlanId,
          status: "pending_activation",
          expires_at: null
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("建立方案失敗");
      return;
    }

    await createSubscriptionLog({
      storeId,
      subscriptionId: newSub?.id || null,
      oldPlanId: null,
      newPlanId,
      action: "create",
      note: "admin 建立新方案"
    });

    alert("已建立新方案，等待第一台車審核通過後開始計算時間。");
    return;
  }

  const { error } = await supabase
    .from("seller_subscriptions")
    .update({
      plan_id: newPlanId
    })
    .eq("id", subscription.id);

  if (error) {
    console.error(error);
    alert("切換方案失敗");
    return;
  }

  await createSubscriptionLog({
    storeId: subscription.store_id,
    subscriptionId: subscription.id,
    oldPlanId: subscription.plan_id,
    newPlanId,
    action: "switch",
    note: `admin 切換方案為 ${newPlan.name}`
  });

  alert(`方案已切換為：${newPlan.name}`);
}

async function approveCar(carId) {
  const targetCar = adminCars.find((car) => String(car.id) === String(carId));

  const { error } = await supabase
    .from("cars")
    .update({
      status: "active",
      review_note: null
    })
    .eq("id", carId);

  if (error) {
    console.error("審核通過失敗:", error);
    alert("審核通過失敗，請看 Console");
    return;
  }

  if (targetCar?.store_id) {
    await activateSubscriptionByFirstApprovedCar(targetCar.store_id);
  }

  alert("車輛已審核通過並上架。");
  await loadAdminCars();
}

async function rejectCar(carId) {
  const reason = prompt("請輸入退回原因：");
  if (reason === null) return;

  const { error } = await supabase
    .from("cars")
    .update({
      status: "rejected",
      review_note: reason || "車輛資料未通過審核"
    })
    .eq("id", carId);

  if (error) {
    console.error("退回失敗:", error);
    alert("退回失敗，請看 Console");
    return;
  }

  alert("已退回此車輛。");
  await loadAdminCars();
}

async function activateSubscriptionByFirstApprovedCar(storeId) {
  const { data: sub } = await supabase
    .from("seller_subscriptions")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "pending_activation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return;

  const startedAt = new Date();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  await supabase
    .from("seller_subscriptions")
    .update({
      status: "active",
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString()
    })
    .eq("id", sub.id);
}

if (adminSearchInput) {
  adminSearchInput.addEventListener("input", () => {
    applyAdminFilters();
  });
}

document.querySelectorAll(".admin-status-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-status-tab").forEach((item) => {
      item.classList.remove("active");
    });

    btn.classList.add("active");
    currentAdminStatusFilter = btn.dataset.status;
    applyAdminFilters();
  });
});

if (adminStoreFilter) {
  adminStoreFilter.addEventListener("change", () => {
    applyAdminFilters();
  });
}

async function startEditCar(carId) {
  const car = adminCars.find(item => Number(item.id) === Number(carId));

  if (!car) {
    alert("找不到這台車");
    return;
  }

  const { data: imageData, error: imageError } = await supabase
    .from("car_images")
    .select("*")
    .eq("car_id", car.id)
    .order("sort_order", { ascending: true });

  if (imageError) {
    console.error("讀取圖片失敗:", imageError);
    alert("讀取圖片失敗，請看 Console");
    return;
  }

  oldImages =
    imageData && imageData.length > 0
      ? imageData.map(item => item.image_url)
      : [car.image];

  editingCarId = car.id;

  document.getElementById("titleInput").value = car.title || "";
  document.getElementById("brandInput").value = car.brand || "";
  document.getElementById("modelInput").value = car.model || "";
  document.getElementById("yearInput").value = car.year || "";
  document.getElementById("ccInput").value = car.cc || "";
  document.getElementById("priceInput").value = car.price || "";
  document.getElementById("regionInput").value = car.region || "";
  document.getElementById("categoryInput").value = car.category || "";
  document.getElementById("mileageInput").value = car.mileage || "";
  document.getElementById("colorInput").value = car.color || "";
  document.getElementById("equipmentInput").value = car.equipment || "";
  document.getElementById("descInput").value = car.description || "";
  document.getElementById("imageInput").value = "";
  selectedImageFiles = [];
  renderImagePreview();

  addCarBtn.textContent = "儲存修改";
  cancelEditBtn.classList.remove("hidden");
  editModeText.classList.remove("hidden");
  editModeText.textContent = `目前正在編輯：#${car.admin_no || "未編號"}｜${car.title}`;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function deleteCar(carId) {
  const { error: imageError } = await supabase
    .from("car_images")
    .delete()
    .eq("car_id", carId);

  if (imageError) {
    console.error("刪除圖片失敗:", imageError);
    alert("刪除圖片失敗，請看 Console");
    return;
  }

  const { error: favoriteError } = await supabase
    .from("favorites")
    .delete()
    .eq("car_id", String(carId));

  if (favoriteError) {
    console.error("刪除收藏紀錄失敗:", favoriteError);
    alert("刪除收藏紀錄失敗，請看 Console");
    return;
  }

  let deleteQuery = supabase
    .from("cars")
    .delete()
    .eq("id", carId);

  if (isSellerDashboard && currentSellerStore) {
    deleteQuery = deleteQuery.eq("store_id", currentSellerStore.id);
  }

  const { error: carError } = await deleteQuery;

  if (carError) {
    console.error("刪除車輛失敗:", carError);
    alert("刪除車輛失敗，請看 Console");
    return;
  }

  alert("車輛已刪除");
  loadAdminCars();
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    editingCarId = null;
    oldImages = [];

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
    selectedImageFiles = [];
    renderImagePreview();
    document.getElementById("equipmentInput").value = "";
    document.getElementById("descInput").value = "";

    addCarBtn.textContent = "送出";
    cancelEditBtn.classList.add("hidden");
    editModeText.classList.add("hidden");
  });
}

async function getMyStore() {
  const user = await getCurrentUser();

  if (!user) {
    alert("請先登入");
    window.location.href = "login.html";
    return null;
  }

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("讀取車行資料失敗:", error);
    return null;
  }

  return data;
}

loadAdminCars();

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

      let store = null;

      if (car.store_id) {
        const { data: storeData, error: storeError } = await supabase
          .from("stores")
          .select("*")
          .eq("id", car.store_id)
          .maybeSingle();

        if (storeError) {
          console.error("讀取車行資料失敗:", storeError);
        } else {
          store = storeData;
        }
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

          ${store ? `
            <div class="detail-store-box">
              <div class="detail-store-label">販售車行</div>

              <div class="detail-store-name">
                ${store.name}
              </div>

              <p class="detail-store-desc">
                ${store.description || "優質車行，嚴選好車。"}
              </p>

              <a 
                href="store.html?slug=${store.slug}" 
                class="detail-store-link"
              >
                查看車行店面
              </a>
            </div>
          ` : ""}

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
  const mobileMemberCenterBtn = document.getElementById("mobileMemberCenterBtn");

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("讀取會員角色失敗：", profileError);
    }

    if (profile?.role === "seller") {
      memberCenterBtn.textContent = "車行後台";
      memberCenterBtn.href = "seller-dashboard.html";

      if (mobileMemberCenterBtn) {
        mobileMemberCenterBtn.textContent = "車行後台";
        mobileMemberCenterBtn.href = "seller-dashboard.html";
      }
    } else if (profile?.role === "admin") {
      memberCenterBtn.textContent = "管理後台";
      memberCenterBtn.href = "admin.html";

      if (mobileMemberCenterBtn) {
        mobileMemberCenterBtn.textContent = "管理後台";
        mobileMemberCenterBtn.href = "admin.html";
      }
    } else {
      memberCenterBtn.textContent = "會員中心";
      memberCenterBtn.href = "member.html";

      if (mobileMemberCenterBtn) {
        mobileMemberCenterBtn.textContent = "會員中心";
        mobileMemberCenterBtn.href = "member.html";
      }
    }
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

async function loadMemberProfile() {
  if (!window.location.pathname.includes("member.html")) return;

  const nameEl = document.getElementById("userName");
  const emailEl = document.getElementById("userEmail");
  const phoneEl = document.getElementById("userPhone");

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("取得會員失敗:", userError);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, email, phone")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("讀取 profiles 失敗:", profileError);

    if (nameEl) {
      nameEl.textContent = `姓名：${user.user_metadata?.display_name || "未設定"}`;
    }
    if (emailEl) {
      emailEl.textContent = `Email：${user.email || "未設定"}`;
    }
    if (phoneEl) {
      phoneEl.textContent = `手機：${user.phone || "未設定"}`;
    }
    return;
  }

  if (nameEl) {
    nameEl.textContent = `姓名：${profile.display_name || "未設定"}`;
  }
  if (emailEl) {
    emailEl.textContent = `Email：${profile.email || user.email || "未設定"}`;
  }
  if (phoneEl) {
    phoneEl.textContent = `手機：${profile.phone || user.phone || "未設定"}`;
  }
}

loadMemberProfile();

async function loadFavoriteCars() {
  if (!window.location.pathname.includes("member.html")) return;

  const favoriteList = document.getElementById("favoriteList");
  if (!favoriteList) return;

  const user = await getCurrentUser();

  if (!user) {
    favoriteList.innerHTML = `<p>請先登入會員。</p>`;
    return;
  }

  const { data: favoriteRows, error: favoriteError } = await supabase
    .from("favorites")
    .select("car_id")
    .eq("user_id", user.id);

  if (favoriteError) {
    console.error("讀取收藏資料失敗:", favoriteError);
    favoriteList.innerHTML = `<p>讀取收藏失敗，請稍後再試。</p>`;
    return;
  }

  if (!favoriteRows || favoriteRows.length === 0) {
    favoriteList.innerHTML = `<p>目前還沒有收藏任何車輛。</p>`;
    return;
  }

  const favoriteIds = favoriteRows.map(item => item.car_id);

  const { data: carData, error: carError } = await supabase
    .from("cars")
    .select("*")
    .in("id", favoriteIds)
    .order("created_at", { ascending: false });

  if (carError) {
    console.error("讀取收藏車輛失敗:", carError);
    favoriteList.innerHTML = `<p>讀取收藏車輛失敗，請稍後再試。</p>`;
    return;
  }

  if (!carData || carData.length === 0) {
    favoriteList.innerHTML = `<p>目前還沒有收藏任何車輛。</p>`;
    return;
  }

  favoriteList.innerHTML = "";

  carData.forEach(car => {
    const card = document.createElement("div");
    card.className = "car-card";

    card.innerHTML = `
      <button class="favorite-btn active" data-id="${car.id}" type="button">❤️</button>

      <a href="detail.html?id=${car.id}" class="car-link">
        <img src="${car.image}" alt="${car.title}">
        ${car.is_featured ? `<div class="featured-badge">精選</div>` : ""}
        <div class="car-content">
          <h2 class="car-title">${car.title}</h2>
          <div class="card-price">NT$ ${Number(car.price).toLocaleString()}</div>
          <div class="car-meta">
            ${car.category || "-"}｜${car.region || "-"}｜${car.year ? car.year + " 年" : "-"}
          </div>
        </div>
      </a>
    `;

    favoriteList.appendChild(card);
  });

  const favoriteButtons = favoriteList.querySelectorAll(".favorite-btn");

  favoriteButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(btn.dataset.id, btn);
    });
  });
}

loadFavoriteCars();