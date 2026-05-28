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
      const editingCar = adminCars.find((car) => Number(car.id) === Number(editingCarId));

      const updateData = {
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
      };

      if (isSellerDashboard && editingCar?.status === "rejected") {
        updateData.status = "pending_review";
       updateData.review_note = null;
      }

      if (isSellerDashboard && editingCar?.status === "rejected") {
        await loadSellerSubscription();

        if (!currentSellerStore) {
          currentSellerStore = await getMyStore();
        }

        if (currentSellerStore?.status === "suspended") {
          alert("你的車行目前已被平台停權，無法重新送審車輛。");
          return;
        }

        if (!currentSubscription || !currentPlan) {
          alert("請先選擇方案，才能重新送審。");
          return;
        }

        const usedCars = adminCars.filter((car) =>
          ["active", "pending_review"].includes(car.status)
        ).length;

        if (usedCars >= currentPlan.max_cars) {
          alert(`已達方案可刊登上限：${currentPlan.max_cars} 台，請先下架其他車輛後再重新送審。`);
          return;
        }
      }

      let updateQuery = supabase
        .from("cars")
        .update(updateData)
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

      if (isSellerDashboard && editingCar?.status === "rejected") {
        alert("車輛已修改並重新送出審核。");
      } else {
        alert("車輛更新成功！");
      }
    } else {
      
      if (isSellerDashboard) {
        await loadSellerSubscription();

        if (!currentSellerStore) {
          currentSellerStore = await getMyStore();
        }

        if (currentSellerStore?.status === "suspended") {
          alert("你的車行目前已被平台停權，無法新增或送審車輛。");
          return;
        }

        if (!currentSubscription || !currentPlan) {
          alert("請先選擇方案，才能送出車輛審核。");
          return;
        }

        const usedCars = adminCars.filter((car) =>
          ["active", "pending_review"].includes(car.status)
        ).length;

        if (usedCars >= currentPlan.max_cars) {
          alert(`已達方案可刊登上限：${currentPlan.max_cars} 台，待審核車輛也會佔用額度。`);
          return;
        }
      }

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
            image: images && images.length > 0 ? images[0] : null,
            status: "pending_review",
            review_note: null
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

      alert("車輛已送出審核，通過後才會公開上架。");
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

let adminCars = [];

const isSellerDashboard = window.location.pathname.includes("seller-dashboard.html");
let currentSellerStore = null;
let currentSubscription = null;
let currentPlan = null;

const notificationList = document.getElementById("notificationList");
const sellerChatList = document.getElementById("sellerChatList");
const sellerChatRoom = document.getElementById("sellerChatRoom");
let currentSellerChatThreadId = null;
let adminSellerThreads = [];
let sellerChatChannel = null;
let sellerBellChannel = null;

const sellerChatBadge = document.getElementById("sellerChatBadge");
const sellerChatBell = document.getElementById("sellerChatBell");
const sellerChatBellBadge = document.getElementById("sellerChatBellBadge");
const sellerBellDropdown = document.getElementById("sellerBellDropdown");
const sellerNavBtns = document.querySelectorAll(".seller-nav-btn");
const sellerPages = document.querySelectorAll(".seller-page");

function showSellerPage(pageName) {
  sellerPages.forEach((page) => {
    page.classList.add("hidden");
  });

  const targetPage = document.getElementById(`${pageName}Page`);

  if (targetPage) {
    targetPage.classList.remove("hidden");
  }

  sellerNavBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageName);
  });
}

sellerNavBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    showSellerPage(btn.dataset.page);

    if (btn.dataset.page === "plan") {
      await renderPlanPage();
    }

    if (btn.dataset.page === "notifications") {
      await loadNotifications();
    }

    if (btn.dataset.page === "chat") {
      await loadSellerChats();
    }
  });
});

async function loadAdminCars() {
  if (!adminCarList) return;

  adminCarList.innerHTML = "<p>車輛讀取中...</p>";

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
  renderAdminCars(adminCars);
  updateOverviewCarCount();
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
        <p class="car-status-text">
          狀態：${
            car.status === "active"
              ? "上架中"
              : car.status === "pending_review"
                ? "等待審核"
                : car.status === "rejected"
                  ? "審核未通過"
                  : "已下架"
          }
        </p>
        <p class="car-status-text">
          精選：${car.is_featured ? "是" : "否"}
        </p>

        ${car.status === "rejected" && car.review_note ? `
          <p class="car-review-note">
            退回原因：${car.review_note}
          </p>
        ` : ""}
      </div>

      <div class="admin-action-row">
        <button class="admin-edit-btn" data-id="${car.id}">
          ${car.status === "rejected" ? "修改後重新送審" : "編輯"}
        </button>

        ${["active", "inactive"].includes(car.status) ? `
          <button class="toggle-status-btn" data-id="${car.id}">
            ${car.status === "active" ? "下架" : "重新上架"}
          </button>
        ` : ""}
        <button class="toggle-featured-btn" data-id="${car.id}">
          ${car.is_featured ? "取消精選" : "設為精選"}
        </button>

        <button class="admin-delete-btn" data-id="${car.id}">
          刪除
        </button>
    </div>
    `;

    adminCarList.appendChild(item);
  });

  document.querySelectorAll(".admin-edit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const carId = Number(btn.dataset.id);
      await startEditCar(carId);
    });
  });

  document.querySelectorAll(".toggle-status-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const carId = btn.dataset.id;
      await toggleCarStatus(carId);
    });
  });

  document.querySelectorAll(".toggle-featured-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const carId = btn.dataset.id;
      await toggleFeaturedCar(carId);
    });
  });

  document.querySelectorAll(".admin-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const carId = btn.dataset.id;

      const confirmDelete = confirm("確定要刪除這台車嗎？刪除後無法復原。");
      if (!confirmDelete) return;

      await deleteCar(carId);
    });
  });
}

function updateOverviewCarCount() {
  const overviewActiveCars = document.getElementById("overviewActiveCars");
  if (!overviewActiveCars) return;

  const activeCount = adminCars.filter((car) => car.status === "active").length;
  overviewActiveCars.textContent = `${activeCount} 台`;
}

if (adminSearchInput) {
  adminSearchInput.addEventListener("input", () => {
    const keyword = adminSearchInput.value.trim().toLowerCase();

    const filtered = adminCars.filter((car) => {
      return (
        String(car.admin_no || "").includes(keyword) ||
        String(car.title || "").toLowerCase().includes(keyword) ||
        String(car.brand || "").toLowerCase().includes(keyword) ||
        String(car.model || "").toLowerCase().includes(keyword) ||
        String(car.region || "").toLowerCase().includes(keyword) ||
        String(car.category || "").toLowerCase().includes(keyword)
      );
    });

    renderAdminCars(filtered);
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

  showSellerPage("addCar");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function toggleCarStatus(carId) {
  const targetCar = adminCars.find((car) => String(car.id) === String(carId));

  if (!targetCar) {
    alert("找不到這台車");
    return;
  }

  const nextStatus = targetCar.status === "active" ? "inactive" : "active";

  if (targetCar.status === "pending_review") {
    alert("這台車正在審核中，不能手動上架。");
    return;
  }

  if (targetCar.status === "rejected") {
    alert("這台車審核未通過，請編輯後重新送審。");
    return;
  }

  // 之後付費功能會接在這裡
  // 如果 nextStatus === "active"，就檢查是否有有效方案
  if (nextStatus === "active") {
    await loadSellerSubscription();

    if (!isSubscriptionValid()) {
      alert("你的方案尚未開通或已到期，無法上架車輛。");
      return;
    }

    const usedCars = adminCars.filter((car) =>
      ["active", "pending_review"].includes(car.status)
    ).length;

    if (usedCars >= currentPlan.max_cars) {
      alert(`已達方案可刊登上限：${currentPlan.max_cars} 台`);
      return;
    }
  }

  let updateQuery = supabase
    .from("cars")
    .update({
      status: nextStatus
    })
    .eq("id", carId);

  if (currentSellerStore) {
    updateQuery = updateQuery.eq("store_id", currentSellerStore.id);
  }

  const { error } = await updateQuery;

  if (error) {
    console.error("更新上下架狀態失敗:", error);
    alert("更新上下架狀態失敗，請看 Console");
    return;
  }

  alert(nextStatus === "active" ? "車輛已重新上架" : "車輛已下架");
  loadAdminCars();
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

async function toggleFeaturedCar(carId) {
  const targetCar = adminCars.find((car) => String(car.id) === String(carId));

  if (!targetCar) {
    alert("找不到這台車");
    return;
  }

  const nextFeatured = !targetCar.is_featured;

  if (nextFeatured) {
    await loadSellerSubscription();

    if (!isSubscriptionValid()) {
      alert("你的方案尚未開通或已到期，無法設定精選車。");
      return;
    }

    const featuredCars = adminCars.filter((car) => car.is_featured).length;

    if (featuredCars >= currentPlan.featured_limit) {
      alert(`已達精選車上限：${currentPlan.featured_limit} 台`);
      return;
    }
  }

  let updateQuery = supabase
    .from("cars")
    .update({
      is_featured: nextFeatured
    })
    .eq("id", carId);

  if (currentSellerStore) {
    updateQuery = updateQuery.eq("store_id", currentSellerStore.id);
  }

  const { error } = await updateQuery;

  if (error) {
    console.error("更新精選狀態失敗:", error);
    alert("更新精選狀態失敗，請看 Console");
    return;
  }

  alert(nextFeatured ? "已設為精選車" : "已取消精選");
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

async function loadSellerSubscription() {
  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  if (!currentSellerStore) return null;

  const { data, error } = await supabase
    .from("seller_subscriptions")
    .select(`
      *,
      plans (*)
    `)
    .eq("store_id", currentSellerStore.id)
    .in("status", ["active", "pending_activation"])
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("讀取方案失敗:", error);
    return null;
  }

  currentSubscription = data;
  currentPlan = data?.plans || null;

  return data;
}

function isSubscriptionValid() {
  if (!currentSubscription || !currentPlan) return false;

  if (!currentSubscription.expires_at) return false;

  const expiresAt = new Date(currentSubscription.expires_at);
  const now = new Date();

  return currentSubscription.status === "active" && expiresAt > now;
}

async function renderPlanPage() {
  await loadSellerSubscription();

  const usedCars = adminCars.filter((car) =>
    ["active", "pending_review"].includes(car.status)
  ).length;

  const featuredCars = adminCars.filter((car) => car.is_featured).length;

  document.getElementById("currentPlanName").textContent =
    currentPlan?.name || "尚未開通";

  document.getElementById("currentPlanMaxCars").textContent =
    currentPlan?.max_cars || 0;

  document.getElementById("currentPlanUsedCars").textContent =
    usedCars;

  document.getElementById("currentPlanFeatured").textContent =
    `${featuredCars} / ${currentPlan?.featured_limit || 0}`;

  document.getElementById("currentPlanExpires").textContent =
    currentSubscription?.expires_at
      ? new Date(currentSubscription.expires_at).toLocaleDateString("zh-TW")
      : "尚未設定";
  
  const noticeEl = document.getElementById("planExpireNotice");

  if (noticeEl) {
    noticeEl.textContent = "";
    noticeEl.classList.remove("danger");

    if (currentSubscription?.status === "pending_activation") {
      noticeEl.textContent = "方案已選擇，等待第一台車審核通過後開始計算時間。";
    } else if (!currentSubscription?.expires_at) {
      noticeEl.textContent = "尚未開通方案，請先選擇方案。";
    } else {
      const expiresAt = new Date(currentSubscription.expires_at);
      const now = new Date();
      const diffDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        noticeEl.textContent = "方案已到期，請續約後再上架車輛。";
        noticeEl.classList.add("danger");
      } else if (diffDays <= 7) {
        noticeEl.textContent = `方案將於 ${diffDays} 天後到期，建議盡快續約。`;
        noticeEl.classList.add("danger");
      } else {
        noticeEl.textContent = `方案仍有效，剩餘 ${diffDays} 天。`;
      }
    }
  }

  await loadPlanList();
}

async function loadNotifications() {
  if (!notificationList) return;

  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  if (!currentSellerStore) {
    notificationList.innerHTML = "<p>找不到車行資料。</p>";
    return;
  }

  notificationList.innerHTML = "<p>通知讀取中...</p>";

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("store_id", currentSellerStore.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("讀取通知失敗:", error);
    notificationList.innerHTML = "<p>通知讀取失敗。</p>";
    return;
  }

  renderNotifications(data || []);
}

async function loadSellerChats() {
  if (!sellerChatList) return;

  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  if (!currentSellerStore) {
    sellerChatList.innerHTML = "<p>找不到車行資料。</p>";
    return;
  }

  sellerChatList.innerHTML = "<p>聊天讀取中...</p>";

  const { data, error } = await supabase
    .from("chat_threads")
    .select(`
      *,
      cars (
        title,
        image,
        price
      )
    `)
    .eq("store_id", currentSellerStore.id)
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("讀取聊天失敗:", error);
    sellerChatList.innerHTML = "<p>讀取聊天失敗。</p>";
    return;
  }

  adminSellerThreads = data || [];
  renderSellerChats(data || []);
}

function renderSellerChats(threads) {
  if (!sellerChatList) return;

  if (!threads.length) {
    sellerChatList.innerHTML = "<p>目前沒有聊天訊息。</p>";
    return;
  }

  sellerChatList.innerHTML = "";

  threads.forEach((thread) => {
    const card = document.createElement("div");
    card.className = "seller-chat-card";

    card.innerHTML = `
      <div>
        <strong>${thread.cars?.title || "未知車輛"}</strong>
        <p>${thread.last_message || "尚無訊息"}</p>
        <small>${new Date(thread.last_message_at).toLocaleString("zh-TW")}</small>
      </div>

      <button class="open-chat-btn" data-thread-id="${thread.id}">
        開啟
      </button>
    `;

    sellerChatList.appendChild(card);
  });

  document.querySelectorAll(".open-chat-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await openSellerChatRoom(btn.dataset.threadId);
    });
  });
}

async function openSellerChatRoom(threadId) {
  if (!sellerChatRoom) return;

  currentSellerChatThreadId = Number(threadId);
  sellerChatRoom.innerHTML = "<p>聊天內容讀取中...</p>";

  await supabase
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", currentSellerChatThreadId)
    .eq("sender_role", "buyer")
    .is("read_at", null);

  await updateSellerChatBadge();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", currentSellerChatThreadId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("讀取聊天內容失敗:", error);
    sellerChatRoom.innerHTML = "<p>讀取聊天內容失敗。</p>";
    return;
  }

  const thread = adminSellerThreads?.find(
    (t) => Number(t.id) === Number(threadId)
  );

  sellerChatRoom.innerHTML = `
    <div class="chat-room-header">
      ${
        thread?.cars?.image
          ? `<img src="${thread.cars.image}" class="chat-room-car-image" />`
          : ""
      }

      <div>
        <strong>${thread?.cars?.title || "未知車輛"}</strong>
        <p>${thread?.cars?.price ? `NT$ ${Number(thread.cars.price).toLocaleString()}` : ""}</p>
      </div>
    </div>

    <div id="sellerChatMessages" class="chat-message-list"></div>
  
    <div class="chat-input-row">
      <input id="sellerChatInput" placeholder="輸入回覆內容..." />
      <button id="sellerChatSendBtn" type="button">送出</button>
    </div>
  `;

  renderSellerChatMessages(data || []);

  document.getElementById("sellerChatSendBtn").addEventListener("click", sendSellerChatMessage);

  document.getElementById("sellerChatInput").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await sendSellerChatMessage();
    }
  });

  subscribeSellerChatRoom(currentSellerChatThreadId);
}

function subscribeSellerChatRoom(threadId) {
  if (sellerChatChannel) {
    supabase.removeChannel(sellerChatChannel);
  }

  sellerChatChannel = supabase
    .channel(`seller-chat-${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `thread_id=eq.${threadId}`
      },
      async () => {
        await openSellerChatRoom(threadId);
        await loadSellerChats();
        await updateSellerChatBadge();
      }
    )
    .subscribe();
}

function renderSellerChatMessages(messages) {
  const box = document.getElementById("sellerChatMessages");
  if (!box) return;

  box.innerHTML = "";

  messages.forEach((msg) => {
    const item = document.createElement("div");
    item.className = `chat-bubble ${msg.sender_role === "seller" ? "me" : "other"}`;

    item.innerHTML = `
      <p>${msg.message}</p>
      <small>
        ${new Date(msg.created_at).toLocaleDateString("zh-TW")}
        ${new Date(msg.created_at).toLocaleTimeString("zh-TW", {
          hour: "2-digit",
          minute: "2-digit"
        })}
      </small>
    `;

    box.appendChild(item);
  });

  box.scrollTop = box.scrollHeight;

  setTimeout(() => {
    box.scrollTop = box.scrollHeight;
  }, 50);
}

async function sendSellerChatMessage() {
  const input = document.getElementById("sellerChatInput");
  const message = input?.value.trim();

  if (!message || !currentSellerChatThreadId) return;

  const user = await getCurrentUser();

  const { error } = await supabase
    .from("chat_messages")
    .insert([
      {
        thread_id: currentSellerChatThreadId,
        sender_id: user.id,
        sender_role: "seller",
        message
      }
    ]);

  if (error) {
    console.error("送出訊息失敗:", error);
    alert("送出失敗");
    return;
  }

  await supabase
    .from("chat_threads")
    .update({
      last_message: message,
      last_message_at: new Date().toISOString()
    })
    .eq("id", currentSellerChatThreadId);

  input.value = "";
  await openSellerChatRoom(currentSellerChatThreadId);
  await loadSellerChats();
}

async function replySellerChat(threadId) {
  const user = await getCurrentUser();
  const { data: messages, error: msgError } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", Number(threadId))
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("讀取聊天內容失敗:", msgError);
  }

  const historyText = (messages || [])
    .map((msg) => {
      const name = msg.sender_role === "buyer" ? "買家" : "賣家";
      return `${name}：${msg.message}`;
    })
    .join("\n");

  if (!user) {
    alert("請重新登入");
    return;
  }

  const message = prompt(
    `聊天紀錄：\n\n${historyText || "目前沒有訊息"}\n\n請輸入回覆內容：`
  );

  if (!message || !message.trim()) return;

  const { error } = await supabase
    .from("chat_messages")
    .insert([
      {
        thread_id: Number(threadId),
        sender_id: user.id,
        sender_role: "seller",
        message: message.trim()
      }
    ]);

  if (error) {
    console.error("回覆失敗:", error);
    alert("回覆失敗");
    return;
  }

  await supabase
    .from("chat_threads")
    .update({
      last_message: message.trim(),
      last_message_at: new Date().toISOString()
    })
    .eq("id", threadId);

  alert("已回覆買家。");
  await loadSellerChats();
}

async function updateSellerChatBadge() {
  if (!sellerChatBadge) return;

  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  const { data: threads } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("store_id", currentSellerStore.id);

  const threadIds = (threads || []).map((t) => t.id);

  if (!threadIds.length) {
    sellerChatBadge.classList.add("hidden");
    return;
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id")
    .in("thread_id", threadIds)
    .eq("sender_role", "buyer")
    .is("read_at", null);

  const count = messages?.length || 0;

  sellerChatBadge.textContent = count;
  sellerChatBadge.classList.toggle("hidden", count === 0);

  if (sellerChatBellBadge) {
    sellerChatBellBadge.textContent = count;
    sellerChatBellBadge.classList.toggle("hidden", count === 0);
  }
}

async function loadSellerBellDropdown() {
  if (!sellerBellDropdown) return;

  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  const { data: threads } = await supabase
    .from("chat_threads")
    .select("id, car_id, last_message, last_message_at, cars(title)")
    .eq("store_id", currentSellerStore.id)
    .order("last_message_at", { ascending: false })
    .limit(10);

  const threadIds = (threads || []).map((t) => t.id);

  if (!threadIds.length) {
    sellerBellDropdown.innerHTML = `<p class="bell-empty">目前沒有訊息</p>`;
    return;
  }

  const { data: unreadMessages } = await supabase
    .from("chat_messages")
    .select("thread_id")
    .in("thread_id", threadIds)
    .eq("sender_role", "buyer")
    .is("read_at", null);

  const unreadThreadIds = new Set((unreadMessages || []).map((m) => m.thread_id));

  const unreadThreads = (threads || []).filter((t) => unreadThreadIds.has(t.id));

  if (!unreadThreads.length) {
    sellerBellDropdown.innerHTML = `<p class="bell-empty">沒有未讀聊天</p>`;
    return;
  }

  sellerBellDropdown.innerHTML = unreadThreads.map((thread) => `
    <button class="bell-message-item" data-thread-id="${thread.id}">
      <strong>${thread.cars?.title || "未知車輛"}</strong>
      <span>${thread.last_message || "新訊息"}</span>
      <small>${new Date(thread.last_message_at).toLocaleString("zh-TW")}</small>
    </button>
  `).join("");

  sellerBellDropdown.querySelectorAll(".bell-message-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      sellerBellDropdown.classList.add("hidden");
      showSellerPage("chat");

      document.querySelectorAll(".seller-nav-btn").forEach((item) => {
        item.classList.toggle("active", item.dataset.page === "chat");
      });

      await loadSellerChats();
      await openSellerChatRoom(btn.dataset.threadId);
    });
  });
}

async function subscribeSellerBellRealtime() {
  if (sellerBellChannel) {
    supabase.removeChannel(sellerBellChannel);
  }

  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  sellerBellChannel = supabase
    .channel(`seller-bell-${currentSellerStore.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages"
      },
      async () => {
        await updateSellerChatBadge();

        if (sellerBellDropdown && !sellerBellDropdown.classList.contains("hidden")) {
          await loadSellerBellDropdown();
        }
      }
    )
    .subscribe();
}

if (sellerChatBell) {
  sellerChatBell.addEventListener("click", async () => {
    if (!sellerBellDropdown) return;

    sellerBellDropdown.classList.toggle("hidden");

    if (!sellerBellDropdown.classList.contains("hidden")) {
      await loadSellerBellDropdown();
    }
  });
}

function renderNotifications(notifications) {
  if (!notificationList) return;

  if (!notifications.length) {
    notificationList.innerHTML = "<p>目前沒有通知。</p>";
    return;
  }

  notificationList.innerHTML = "";

  notifications.forEach((item) => {
    const card = document.createElement("div");
    card.className = `notification-card ${item.is_read ? "" : "unread"}`;

    card.innerHTML = `
      <strong>${item.title}</strong>
      <p>${item.message || ""}</p>
      <small>${new Date(item.created_at).toLocaleString("zh-TW")}</small>
    `;

    notificationList.appendChild(card);
  });
}

async function loadPlanList() {
  const planList = document.getElementById("planList");
  if (!planList) return;

  planList.innerHTML = "<p>方案讀取中...</p>";

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    console.error("讀取方案列表失敗:", error);
    planList.innerHTML = "<p>方案讀取失敗。</p>";
    return;
  }

  planList.innerHTML = "";

  data.forEach((plan) => {
    const item = document.createElement("div");
    item.className = "seller-plan-option-card";

    item.innerHTML = `
      <div class="plan-card-head">
        <h3>${plan.name}</h3>
        <strong>NT$ ${Number(plan.price).toLocaleString()}</strong>
        <span>/ 月</span>
      </div>

      <ul class="plan-feature-list">
        <li>可上架 ${plan.max_cars} 台車</li>
        <li>精選車 ${plan.featured_limit} 台</li>
        <li>${plan.allow_top ? "可使用置頂車" : "不可使用置頂車"}</li>
        <li>${plan.allow_premium_template ? "可使用高級模板" : "一般店面模板"}</li>
      </ul>

      <button type="button" class="select-plan-btn" data-id="${plan.id}">
        ${currentPlan?.id === plan.id ? "續約此方案" : "選擇此方案"}
      </button>
    `;

    planList.appendChild(item);
  });

  document.querySelectorAll(".select-plan-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const planId = Number(btn.dataset.id);
      const plan = data.find((item) => item.id === planId);

      const ok = confirm(
        `確定要${currentPlan?.id === planId ? "續約" : "選擇"}「${plan.name}」嗎？`
      );

      if (!ok) return;

      await activateTestPlan(planId);
    });
  });
}

async function activateTestPlan(planId) {
  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  if (!currentSellerStore) {
    alert("找不到車行資料");
    return;
  }

  await supabase
    .from("seller_subscriptions")
    .update({ status: "inactive" })
    .eq("store_id", currentSellerStore.id)
    .in("status", ["active", "pending_activation"])

  const { error } = await supabase
    .from("seller_subscriptions")
    .insert([
      {
        store_id: currentSellerStore.id,
        plan_id: Number(planId),
        expires_at: null,
        status: "pending_activation"
      }
    ]);

  if (error) {
    console.error("開通方案失敗:", error);
    alert("開通方案失敗，請看 Console");
    return;
  }

  alert("方案已選擇，將在第一台車審核通過後開始計算 1 個月。");
  await renderPlanPage();
}

const logoFileInput = document.getElementById("storeLogoFile");
const bannerDesktopFileInput = document.getElementById("storeBannerDesktopFile");
const bannerMobileFileInput = document.getElementById("storeBannerMobileFile");

const logoPreview = document.getElementById("logoPreview");
const bannerDesktopPreview = document.getElementById("bannerDesktopPreview");
const bannerMobilePreview = document.getElementById("bannerMobilePreview");

const cropModal = document.getElementById("cropModal");
const cropImage = document.getElementById("cropImage");
const cropTitle = document.getElementById("cropTitle");
const cropHint = document.getElementById("cropHint");
const cancelCropBtn = document.getElementById("cancelCropBtn");
const confirmCropBtn = document.getElementById("confirmCropBtn");

let cropper = null;
let currentCropTarget = null;

const cropSettings = {
  logo: {
    title: "Logo 圓形裁切",
    hint: "虛線框內就是圓形 Logo 會保留的範圍。",
    aspectRatio: 1,
    width: 400,
    height: 400,
    inputId: "storeLogoEdit",
    preview: logoPreview
  },
  desktopBanner: {
    title: "電腦版 Banner 裁切",
    hint: "請把重要文字和人物放在虛線框內，電腦版會照這個比例顯示。",
    aspectRatio: 1920 / 520,
    width: 1920,
    height: 520,
    inputId: "storeBannerDesktopEdit",
    preview: bannerDesktopPreview
  },
  mobileBanner: {
    title: "手機版 Banner 裁切",
    hint: "手機版比較窄，請把重要內容放中間。",
    aspectRatio: 900 / 1200,
    width: 900,
    height: 1200,
    inputId: "storeBannerMobileEdit",
    preview: bannerMobilePreview
  }
};

function openCropper(file, target) {
  if (!file || !cropModal || !cropImage) return;

  currentCropTarget = target;
  const setting = cropSettings[target];

  cropTitle.textContent = setting.title;
  cropHint.textContent = setting.hint;

  const imageUrl = URL.createObjectURL(file);
  cropImage.src = imageUrl;
  cropModal.classList.remove("hidden");

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  cropImage.onload = () => {
    cropper = new Cropper(cropImage, {
      aspectRatio: setting.aspectRatio,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.9,
      background: false,
      guides: true,
      center: true,
      movable: true,
      zoomable: true,
      scalable: false,
      rotatable: false,
      cropBoxMovable: true,
      cropBoxResizable: false
    });
  };
}

function closeCropper() {
  cropModal.classList.add("hidden");

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  cropImage.src = "";
  currentCropTarget = null;
}

if (logoFileInput) {
  logoFileInput.addEventListener("change", (e) => {
    openCropper(e.target.files[0], "logo");
  });
}

if (bannerDesktopFileInput) {
  bannerDesktopFileInput.addEventListener("change", (e) => {
    openCropper(e.target.files[0], "desktopBanner");
  });
}

if (bannerMobileFileInput) {
  bannerMobileFileInput.addEventListener("change", (e) => {
    openCropper(e.target.files[0], "mobileBanner");
  });
}

if (cancelCropBtn) {
  cancelCropBtn.addEventListener("click", closeCropper);
}

if (confirmCropBtn) {
  confirmCropBtn.addEventListener("click", () => {
    if (!cropper || !currentCropTarget) return;

    const setting = cropSettings[currentCropTarget];

    const canvas = cropper.getCroppedCanvas({
      width: setting.width,
      height: setting.height,
      imageSmoothingQuality: "high"
    });

    const base64 = canvas.toDataURL("image/jpeg", 0.9);

    document.getElementById(setting.inputId).value = base64;

    if (setting.preview) {
      setting.preview.src = base64;
      setting.preview.style.display = "block";
    }

    closeCropper();
  });
}

async function loadSellerStoreSettings() {
  if (!isSellerDashboard) return;

  const nameInput = document.getElementById("storeNameEdit");
  const descInput = document.getElementById("storeDescEdit");
  const logoInput = document.getElementById("storeLogoEdit");
  const bannerDesktopInput = document.getElementById("storeBannerDesktopEdit");
  const bannerMobileInput = document.getElementById("storeBannerMobileEdit");

  if (!nameInput) return;

  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  if (!currentSellerStore) return;

  const overviewStoreName = document.getElementById("overviewStoreName");
  const overviewStoreDesc = document.getElementById("overviewStoreDesc");
  const publicStoreLink = document.getElementById("publicStoreLink");

  if (overviewStoreName) {
    overviewStoreName.textContent = currentSellerStore.name || "尚未設定";
  }

  if (overviewStoreDesc) {
    overviewStoreDesc.textContent = currentSellerStore.description || "尚未填寫店面介紹";
  }

  if (publicStoreLink) {
    const storeSlug = currentSellerStore.slug || currentSellerStore.id;
    publicStoreLink.href = `store.html?store=${encodeURIComponent(storeSlug)}`;
  }

  nameInput.value = currentSellerStore.name || "";
  descInput.value = currentSellerStore.description || "";
  logoInput.value = currentSellerStore.logo_url || "";
  bannerDesktopInput.value = currentSellerStore.banner_desktop_url || currentSellerStore.banner_url || "";
  bannerMobileInput.value = currentSellerStore.banner_mobile_url || "";

  if (bannerDesktopPreview && (currentSellerStore.banner_desktop_url || currentSellerStore.banner_url)) {
    bannerDesktopPreview.src = currentSellerStore.banner_desktop_url || currentSellerStore.banner_url;
    bannerDesktopPreview.style.display = "block";
  }

  if (bannerMobilePreview && currentSellerStore.banner_mobile_url) {
    bannerMobilePreview.src = currentSellerStore.banner_mobile_url;
    bannerMobilePreview.style.display = "block";
  }

  if (logoPreview && currentSellerStore.logo_url) {
    logoPreview.src = currentSellerStore.logo_url;
    logoPreview.style.display = "block";
  }
}

const saveStoreBtn = document.getElementById("saveStoreBtn");

if (saveStoreBtn) {
  saveStoreBtn.addEventListener("click", async () => {
    if (!currentSellerStore) {
      currentSellerStore = await getMyStore();
    }

    if (!currentSellerStore) {
      alert("找不到你的車行資料");
      return;
    }

    const name = document.getElementById("storeNameEdit").value.trim();
    const description = document.getElementById("storeDescEdit").value.trim();
    const logo_url = document.getElementById("storeLogoEdit").value.trim();
    const banner_desktop_url = document.getElementById("storeBannerDesktopEdit").value.trim();
    const banner_mobile_url = document.getElementById("storeBannerMobileEdit").value.trim();

    const { error } = await supabase
      .from("stores")
      .update({
        name,
        description,
        logo_url: logo_url || null,
        banner_url: banner_desktop_url || null,
        banner_desktop_url: banner_desktop_url || null,
        banner_mobile_url: banner_mobile_url || null
      })
      .eq("id", currentSellerStore.id);

    if (error) {
      console.error("更新店面資料失敗:", error);
      alert("更新店面資料失敗，請看 Console");
      return;
    }

    alert("店面資料已更新！");
    currentSellerStore = await getMyStore();
    loadSellerStoreSettings();
  });
}

document.addEventListener("click", (e) => {
  if (!sellerBellDropdown || !sellerChatBell) return;

  const clickedInsideBell =
    sellerChatBell.contains(e.target) || sellerBellDropdown.contains(e.target);

  if (!clickedInsideBell) {
    sellerBellDropdown.classList.add("hidden");
  }
});

loadSellerStoreSettings();
loadAdminCars();
updateSellerChatBadge();
subscribeSellerBellRealtime();