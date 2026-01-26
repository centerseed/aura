import os
import sys

# 1. Load Env vars immediately
from dotenv import load_dotenv
load_dotenv("backend/.env")

# 2. Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

import streamlit as st
import asyncio
import uuid

# Streamlit Elements for Material UI components
from streamlit_elements import elements, mui, html, dashboard, sync, lazy

from app.services.librarian import LibrarianService
from app.domain.models import User, Area, Product, Topic, Task, GovernanceProposal
from app.infrastructure.db import get_db_session
from sqlmodel import select, delete

# Simplified Service without full DI for POC
librarian = LibrarianService()

st.set_page_config(page_title="Zentropy", page_icon="🧘", layout="wide")

# CSS for aesthetic
st.markdown("""
<style>
    .stTextArea textarea {
        font-size: 1.2rem;
        line-height: 1.6;
    }
    .big-button button {
        width: 100%;
        padding: 1rem;
        font-size: 1.5rem;
    }
    .insight-box {
        background-color: #f0f2f6; 
        padding: 2rem; 
        border-radius: 10px; 
        border-left: 5px solid #ff4b4b;
        font-size: 1.2rem;
        font-family: 'Georgia', serif;
    }
</style>
""", unsafe_allow_html=True)

# Session State Init
if 'step' not in st.session_state:
    st.session_state.step = 'act1'
if 'user_alias' not in st.session_state:
    st.session_state.user_alias = None
if 'brain_dump_text' not in st.session_state:
    st.session_state.brain_dump_text = ""
if 'insight_data' not in st.session_state:
    st.session_state.insight_data = None
if 'onboarded' not in st.session_state:
    st.session_state.onboarded = False
if 'selected_areas' not in st.session_state:
    st.session_state.selected_areas = []

def run_sync(coro):
    """Robust sync wrapper for async coroutines in Streamlit."""
    try:
        # Try to get existing loop if any
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        # In streamlit, sometimes a loop is already running.
        # This is a bit tricky, but for POC we'll use a nested runner or start separate.
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(coro)
    else:
        return loop.run_until_complete(coro)

async def create_area_for_user(user_id: uuid.UUID, area_name: str, scope: str):
    """創建 Area 並存入資料庫"""
    async with get_db_session() as session:
        # 檢查是否已存在
        result = await session.execute(
            select(Area).where(Area.user_id == user_id).where(Area.name == area_name)
        )
        existing = result.scalars().first()

        if not existing:
            area = Area(
                user_id=user_id,
                name=area_name,
                scope=scope,
                is_custom=True,
                description=scope  # 同時存入 description 作為備份
            )
            session.add(area)
            await session.commit()
            await session.refresh(area)
            return area
        else:
            # 更新 scope
            existing.scope = scope
            existing.description = scope
            session.add(existing)
            await session.commit()
            return existing

async def get_user_id(alias: str) -> uuid.UUID:
    """Helper to get user ID from alias, creating if needed."""
    normalized_alias = alias.strip().lower()
    async with get_db_session() as session:
        result = await session.execute(select(User).where(User.email == f"{normalized_alias}@naruvia.local")) # Mock email
        user = result.scalars().first()
        if not user:
            # Create new user
            user = User(email=f"{normalized_alias}@naruvia.local", settings={"alias": alias})
            session.add(user)
            await session.commit()
            await session.refresh(user)
        return user.id

async def check_user_has_areas(user_id: uuid.UUID) -> bool:
    """檢查用戶是否已經建立過 Areas"""
    async with get_db_session() as session:
        result = await session.execute(
            select(Area).where(Area.user_id == user_id)
        )
        areas = result.scalars().all()
        return len(areas) > 0

async def clear_all_user_data(user_id: uuid.UUID):
    """清除用戶的所有數據（危險操作）"""
    async with get_db_session() as session:
        # 按照外鍵依賴順序刪除（從子表到父表）
        # 1. Tasks (depends on Topic, Product, User)
        await session.execute(delete(Task).where(Task.user_id == user_id))

        # 2. Topics (depends on Product)
        await session.execute(delete(Topic).where(Topic.user_id == user_id))

        # 3. Products (depends on Area)
        await session.execute(delete(Product).where(Product.user_id == user_id))

        # 4. Areas (depends on User)
        await session.execute(delete(Area).where(Area.user_id == user_id))

        # 5. Governance Proposals
        await session.execute(delete(GovernanceProposal).where(GovernanceProposal.user_id == user_id))

        # 6. User (最後刪除)
        await session.execute(delete(User).where(User.id == user_id))

        await session.commit()

def onboarding_identity_setup():
    """新用戶身分設定流程"""
    st.title("🌌 歡迎來到 Naruvia")
    st.write(f"嗨 **{st.session_state.user_alias}**，在開始之前，讓我們先建立你的「身分地圖」。")

    st.markdown("---")

    # 解釋概念
    st.info("""
    **💡 什麼是「身分地圖」？**

    生活由不同領域組成，每個領域有不同的責任與事務：
    - **健康**：運動、飲食、身心照護
    - **工作**：日常任務、專案執行
    - **事業**：長期職涯、創業經營
    - **財務**：收支管理、投資理財
    - **人際**：家庭、朋友、社交
    - **個人**：興趣、學習、自我成長

    **Naruvia 會自動將你的資訊分類到這些領域**，讓你專注在當下該關注的事。
    """)

    st.markdown("---")
    st.markdown("### 選擇你需要管理的生活領域")
    st.caption("每個領域代表你生活的一個責任範疇。建議至少選 2-3 個。")

    # 預設選項（簡化版生活領域）
    preset_options = {
        "健康": "運動、飲食、睡眠、身心健康、醫療保健",
        "工作": "日常任務、工作專案、團隊協作、績效達成",
        "事業": "職涯發展、創業經營、技能提升、事業規劃",
        "財務": "收支管理、投資理財、預算規劃、資產配置",
        "人際": "家庭關係、朋友社交、親子教育、人脈經營",
        "個人": "興趣愛好、自我學習、心靈成長、休閒娛樂"
    }

    st.markdown("### 🧘 Zentropy Console")
    selected_presets = []
    cols = st.columns(2)
    for idx, (area_name, scope_desc) in enumerate(preset_options.items()):
        with cols[idx % 2]:
            if st.checkbox(f"**{area_name}**", key=f"preset_{area_name}"):
                selected_presets.append((area_name, scope_desc))
                st.caption(f"_{scope_desc}_")

    st.markdown("---")
    st.markdown("#### 或自定義身分")

    custom_area_name = st.text_input(
        "身分角色名稱",
        placeholder="例如: 志工、學生、專案經理",
        help="給這個身分角色取一個名字"
    )
    custom_area_scope = st.text_area(
        "這個身分負責什麼領域？",
        placeholder="例如: 社區服務、志願活動、公益組織...",
        height=80,
        help="簡單描述這個身分角色的責任範圍"
    )

    # 收集所有選中的 Areas
    all_areas = selected_presets.copy()
    if custom_area_name and custom_area_scope:
        all_areas.append((custom_area_name, custom_area_scope))

    st.markdown("---")

    # 顯示摘要
    if all_areas:
        st.success(f"✓ 你選擇了 {len(all_areas)} 個身分角色")
        for area_name, scope in all_areas:
            st.markdown(f"**{area_name}**")
            st.caption(f"└─ {scope}")
    else:
        st.warning("⚠️ 請至少選擇或創建一個身分角色")

    # 提交按鈕
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("🚀 開始使用 Naruvia", type="primary", use_container_width=True, disabled=len(all_areas) == 0):
            # 創建 Areas
            with st.spinner("正在建立你的身分地圖..."):
                try:
                    # 調用 backend 創建 Areas
                    for area_name, scope in all_areas:
                        run_sync(create_area_for_user(
                            st.session_state.user_id,
                            area_name,
                            scope
                        ))

                    st.session_state.onboarded = True
                    st.session_state.selected_areas = [name for name, _ in all_areas]
                    st.session_state.step = 'act1'
                    st.success("✅ 身分地圖建立完成！")
                    st.rerun()
                except Exception as e:
                    st.error(f"創建失敗: {e}")
                    import traceback
                    st.code(traceback.format_exc())

def handle_name_input():
    """處理名字輸入的回調函數"""
    name = st.session_state.get("name_input_field", "").strip()
    if not name:
        return

    try:
        st.session_state.user_alias = name
        u_id = run_sync(get_user_id(name))
        st.session_state.user_id = u_id
        st.session_state.full_library = run_sync(librarian.get_full_library(u_id))

        has_areas = run_sync(check_user_has_areas(u_id))

        if not has_areas:
            st.session_state.step = 'onboarding'
            st.session_state.onboarded = False
        else:
            st.session_state.onboarded = True
            st.session_state.step = 'dashboard' if st.session_state.full_library else 'act1'
    except Exception as e:
        st.session_state.login_error = str(e)

# --- Sidebar Identity ---
with st.sidebar:
    st.title("👤 身分")

    if not st.session_state.user_alias:
        st.text_input(
            "如何稱呼你？",
            placeholder="輸入名字後按 Enter",
            key="name_input_field",
            on_change=handle_name_input
        )
        if st.session_state.get("login_error"):
            st.error(f"載入失敗: {st.session_state.login_error}")
    else:
        # 已經設置用戶名
        st.success(f"已連結：**{st.session_state.user_alias}**")

        # 顯示當前狀態（調試用）
        with st.expander("🔍 狀態資訊"):
            st.caption(f"當前步驟: `{st.session_state.step}`")
            st.caption(f"已完成 Onboarding: `{st.session_state.onboarded}`")
            st.caption(f"圖書館項目數: `{len(st.session_state.get('full_library', []))}`")
            # 顯示用戶的 Areas
            try:
                has_areas = run_sync(check_user_has_areas(st.session_state.user_id))
                st.caption(f"已建立 Areas: `{has_areas}`")
            except:
                st.caption("Areas 狀態: 檢查失敗")

        if st.button("進入我的 Aura 看板"):
            st.session_state.step = 'dashboard'
            st.rerun()

    st.divider()
    st.caption("Aura POC v0.1")

    if st.button("完全清除狀態 (登出)"):
        st.session_state.clear()
        st.rerun()

    # 危險區域：清除所有數據
    with st.expander("⚠️ 危險操作", expanded=False):
        st.warning("以下操作將**永久刪除**所有數據，無法復原！")

        if st.session_state.user_alias and st.session_state.get('user_id'):
            confirm_text = st.text_input(
                f"輸入 `{st.session_state.user_alias}` 確認刪除",
                key="confirm_delete"
            )

            if st.button("🗑️ 清除所有數據", type="secondary", use_container_width=True):
                if confirm_text == st.session_state.user_alias:
                    try:
                        with st.spinner("正在清除所有數據..."):
                            run_sync(clear_all_user_data(st.session_state.user_id))
                            st.success("✅ 所有數據已清除")
                            # 清空 session 並重新載入
                            st.session_state.clear()
                            st.rerun()
                    except Exception as e:
                        st.error(f"清除失敗: {e}")
                        import traceback
                        st.error(traceback.format_exc())
                else:
                    st.error("❌ 確認文字不正確，操作取消")
        else:
            st.caption("請先登入才能清除數據")

def act1_chaos():
    st.title("🧘 Zentropy")
    st.caption("Information Entropy Reduction System")
    
    st.markdown("## Act 1: The Input")
    
    # Simple greeting if name is set
    if st.session_state.user_alias:
        st.write(f"### 你好, **{st.session_state.user_alias}**。把腦袋現在最亂的東西，全部丟進來。")
    else:
        st.info("👈 請先在左側輸入你的名字，這樣我才能為你建立專屬檔案。")
        st.markdown("### 把腦袋現在最亂的東西，全部丟進來。")

    # Spacer
    st.markdown("---")

    # The Chaos Dump
    st.markdown("### 把腦袋現在最亂的東西，全部丟進來。")
    st.markdown("別管格式，別管分類。不管是工作截止日、要去買牛奶、還是心裡的焦慮，全部倒在下面。")
    
    text = st.text_area(
        "Chaos Input", 
        height=300, 
        placeholder="明天要報稅(好煩)，還有客戶那個案子一直沒進度，覺得很對不起團隊...\n另外這週末要記得幫貓買飼料，不然他會餓死。\n最近背有點痛，是不是該去檢查一下？",
        label_visibility="collapsed"
    )
    
    if st.button("✨ 幫我整理這一切", type="primary", use_container_width=True):
        if not st.session_state.user_alias:
            st.error("👈 請先在左側邊欄告訴我你是誰。")
            return
        if not text:
            st.error("腦袋是空的嗎？隨便打點什麼吧。")
            return
            
        st.session_state.brain_dump_text = text
        # Skip Act 2, go directly to structure
        st.session_state.step = 'act3'
        st.rerun()

def act2_insight():
    st.title("🧙‍♂️ Librarian's Note")
    
    data = st.session_state.insight_data
    if not data:
        st.error("No insight data found.")
        if st.button("Back"):
             st.session_state.step = 'act1'
             st.rerun()
        return

    # Display Narrative
    st.markdown(f"""
    <div class='insight-box'>
        {data.get('insight_text', 'No text generated.')}
    </div>
    """, unsafe_allow_html=True)
    
    # Metadata (Subtle)
    st.markdown("---")
    c1, c2, c3 = st.columns(3)
    c1.metric("Anxiety Level", f"{data.get('anxiety_score', 0)*100:.0f}%")
    c2.metric("Conflicts Detected", len(data.get('detected_contexts', [])))
    if data.get('hidden_project_name'):
        c3.metric("Hidden Project", data.get('hidden_project_name'))

    st.markdown("### 接下來？")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("👉 先幫我整理最焦慮的", type="primary", use_container_width=True):
            st.session_state.step = 'act3'
            st.rerun()
            
    with col2:
        if st.button("🔄 這不是重點，重來", use_container_width=True):
             st.session_state.step = 'act1'
             st.session_state.insight_data = None
             st.rerun()


def act3_clarity():
    """處理 Brain Dump 結果顯示"""
    st.title("✨ 整理完成")

    # 處理新輸入
    if st.session_state.brain_dump_text and 'structured_tasks' not in st.session_state:
        with st.spinner("AI 正在整理你的想法..."):
            try:
                user_id = st.session_state.user_id
                items = run_sync(librarian.structure_chaos(st.session_state.brain_dump_text, user_id))
                st.session_state.full_library = run_sync(librarian.get_full_library(user_id))
                st.session_state.structured_tasks = items
            except Exception as e:
                st.error(f"整理失敗: {e}")
                import traceback
                st.code(traceback.format_exc())
                return

    items = st.session_state.get('full_library', [])

    if not items:
        if not st.session_state.brain_dump_text:
            st.warning("尚無資料，請回到輸入頁開始。")
            if st.button("回到輸入頁"):
                st.session_state.step = 'act1'
                st.rerun()
        return

    # 按 Area 分組
    tree = {}
    for item in items:
        area = item.tag.area.split('_')[-1] if '_' in item.tag.area else item.tag.area
        product = item.tag.product
        if area not in tree:
            tree[area] = {}
        if product not in tree[area]:
            tree[area][product] = []
        tree[area][product].append(item)

    # 顯示結果 - 卡片流
    for area, products in tree.items():
        st.markdown(f"### 🗂️ {area}")

        for product, tasks in products.items():
            # Product 標題
            col_title, col_badge = st.columns([4, 1])
            with col_title:
                st.markdown(f"**📦 {product}**")
            with col_badge:
                st.caption(f"{len(tasks)} 項")

            # Task 卡片
            for task in tasks:
                drawer_colors = {
                    "00_inbox": "#FFF3E0",
                    "10_active": "#E3F2FD",
                    "20_maintain": "#F3E5F5",
                    "30_reference": "#E8F5E9",
                    "40_archive": "#ECEFF1"
                }
                drawer_labels = {
                    "00_inbox": "📥",
                    "10_active": "🚀",
                    "20_maintain": "🔄",
                    "30_reference": "📚",
                    "40_archive": "📦"
                }
                bg = drawer_colors.get(task.drawer.value, "#FAFAFA")
                icon = drawer_labels.get(task.drawer.value, "📌")

                st.markdown(f"""
                <div style="
                    background: {bg};
                    border-radius: 6px;
                    padding: 0.8rem 1rem;
                    margin: 0.3rem 0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                ">
                    <span>{icon}</span>
                    <span style="font-weight: 500;">{task.title}</span>
                    <span style="margin-left: auto; font-size: 0.75rem; color: #888;">{task.tag.topic}</span>
                </div>
                """, unsafe_allow_html=True)

            # 詳情 expander
            with st.expander("💬 詳情", expanded=False):
                if tasks[0].narrative:
                    st.info(tasks[0].narrative)
                st.caption(f"策略: {tasks[0].strategy_used}")
                st.caption(f"理由: {tasks[0].reasoning}")

        st.divider()

    # 底部操作
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("✨ 進入看板", type="primary", use_container_width=True):
            st.session_state.step = 'dashboard'
            st.session_state.brain_dump_text = ""
            if 'structured_tasks' in st.session_state:
                del st.session_state.structured_tasks
            st.rerun()


def dashboard_view():
    """
    Material UI 風格的 Kanban Dashboard
    使用 streamlit-elements 實現美觀的看板介面
    """

    # 載入資料
    if 'full_library' not in st.session_state and st.session_state.user_id:
        st.session_state.full_library = run_sync(librarian.get_full_library(st.session_state.user_id))

    items = st.session_state.get('full_library', [])

    # 初始化狀態
    if 'selected_area' not in st.session_state:
        st.session_state.selected_area = None
    if 'selected_product' not in st.session_state:
        st.session_state.selected_product = None
    if 'move_dialog_open' not in st.session_state:
        st.session_state.move_dialog_open = False
    if 'moving_task' not in st.session_state:
        st.session_state.moving_task = None

    # 構建樹狀結構
    tree = {}
    all_areas = set()

    for item in items:
        area = item.tag.area.split('_')[-1] if '_' in item.tag.area else item.tag.area
        product = item.tag.product
        all_areas.add(area)
        if area not in tree:
            tree[area] = {}
        if product not in tree[area]:
            tree[area][product] = []
        tree[area][product].append(item)

    # 狀態配色
    drawer_styles = {
        "00_inbox": {"bg": "#FFF8E1", "border": "#FFB300", "icon": "inbox", "label": "收件匣"},
        "10_active": {"bg": "#E3F2FD", "border": "#1976D2", "icon": "rocket_launch", "label": "進行中"},
        "20_maintain": {"bg": "#F3E5F5", "border": "#7B1FA2", "icon": "sync", "label": "維護中"},
        "30_reference": {"bg": "#E8F5E9", "border": "#388E3C", "icon": "menu_book", "label": "參考"},
        "40_archive": {"bg": "#ECEFF1", "border": "#546E7A", "icon": "archive", "label": "歸檔"}
    }

    # ===== Material UI Dashboard =====
    with elements("kanban_dashboard"):

        # 頂部標題區
        with mui.Box(sx={"mb": 3, "display": "flex", "alignItems": "center", "gap": 2}):
            mui.icon.Dashboard(sx={"fontSize": 32, "color": "primary.main"})
            mui.Typography("Naruvia Dashboard", variant="h4", sx={"fontWeight": 600})

        # 主要內容區：左側導航 + 右側看板
        with mui.Box(sx={"display": "flex", "gap": 3, "minHeight": "70vh"}):

            # ===== 左側導航面板 =====
            with mui.Paper(elevation=2, sx={
                "width": 280,
                "p": 2,
                "borderRadius": 3,
                "bgcolor": "background.paper"
            }):
                mui.Typography("身分地圖", variant="h6", sx={"mb": 2, "fontWeight": 500})

                if not items:
                    mui.Typography("尚無資料", variant="body2", color="text.secondary")
                else:
                    # Area 列表
                    with mui.List(sx={"p": 0}):
                        for area in sorted(tree.keys()):
                            products = tree[area]
                            is_selected = st.session_state.selected_area == area
                            task_count = sum(len(tasks) for tasks in products.values())

                            # Area 項目
                            with mui.ListItemButton(
                                selected=is_selected,
                                onClick=sync(f"select_area_{area}"),
                                sx={"borderRadius": 2, "mb": 0.5}
                            ):
                                mui.ListItemIcon(mui.icon.Folder(color="primary" if is_selected else "action"))
                                mui.ListItemText(
                                    primary=area,
                                    secondary=f"{task_count} 項目"
                                )
                                if is_selected:
                                    mui.icon.ExpandMore()
                                else:
                                    mui.icon.ChevronRight()

                            # 展開的 Product 列表
                            if is_selected:
                                with mui.Collapse({"in": True}):
                                    with mui.List(sx={"pl": 2}):
                                        for product in sorted(products.keys()):
                                            prod_tasks = products[product]
                                            is_prod_selected = st.session_state.selected_product == product

                                            with mui.ListItemButton(
                                                selected=is_prod_selected,
                                                onClick=sync(f"select_prod_{area}_{product}"),
                                                sx={"borderRadius": 2, "py": 0.5}
                                            ):
                                                mui.ListItemIcon(
                                                    mui.icon.Inventory2(
                                                        sx={"fontSize": 20},
                                                        color="secondary" if is_prod_selected else "action"
                                                    )
                                                )
                                                mui.ListItemText(
                                                    primary=product,
                                                    secondary=f"{len(prod_tasks)} 任務"
                                                )

                    mui.Divider(sx={"my": 2})

                    # 全部顯示按鈕
                    mui.Button(
                        "顯示全部",
                        variant="outlined",
                        startIcon=mui.icon.GridView(),
                        fullWidth=True,
                        onClick=sync("show_all")
                    )

            # ===== 右側任務看板 =====
            with mui.Box(sx={"flex": 1}):

                # 標題
                title = "全部項目"
                if st.session_state.selected_product:
                    title = f"{st.session_state.selected_area} › {st.session_state.selected_product}"
                elif st.session_state.selected_area:
                    title = st.session_state.selected_area

                with mui.Box(sx={"mb": 2, "display": "flex", "alignItems": "center", "justifyContent": "space-between"}):
                    mui.Typography(title, variant="h5", sx={"fontWeight": 500})

                    # 快速輸入按鈕
                    mui.Button(
                        "新增想法",
                        variant="contained",
                        startIcon=mui.icon.Add(),
                        color="primary",
                        onClick=sync("open_input")
                    )

                # 篩選任務
                display_items = []
                for item in items:
                    area = item.tag.area.split('_')[-1] if '_' in item.tag.area else item.tag.area
                    if st.session_state.selected_area and area != st.session_state.selected_area:
                        continue
                    if st.session_state.selected_product and item.tag.product != st.session_state.selected_product:
                        continue
                    display_items.append(item)

                if not display_items:
                    with mui.Box(sx={"textAlign": "center", "py": 8}):
                        mui.icon.Inbox(sx={"fontSize": 64, "color": "text.disabled"})
                        mui.Typography("目前沒有任務", variant="h6", color="text.secondary")
                        mui.Typography("在上方點擊「新增想法」開始", variant="body2", color="text.disabled")
                else:
                    # 任務卡片網格
                    with mui.Box(sx={
                        "display": "grid",
                        "gridTemplateColumns": "repeat(auto-fill, minmax(320px, 1fr))",
                        "gap": 2
                    }):
                        for item in display_items:
                            area = item.tag.area.split('_')[-1] if '_' in item.tag.area else item.tag.area
                            style = drawer_styles.get(item.drawer.value, drawer_styles["00_inbox"])

                            # 任務卡片
                            with mui.Card(
                                elevation=1,
                                sx={
                                    "borderRadius": 2,
                                    "borderLeft": f"4px solid {style['border']}",
                                    "bgcolor": style["bg"],
                                    "transition": "all 0.2s",
                                    "&:hover": {
                                        "elevation": 4,
                                        "transform": "translateY(-2px)"
                                    }
                                }
                            ):
                                with mui.CardContent(sx={"pb": 1}):
                                    # 標題和狀態
                                    with mui.Box(sx={"display": "flex", "justifyContent": "space-between", "mb": 1}):
                                        mui.Typography(
                                            item.title,
                                            variant="subtitle1",
                                            sx={"fontWeight": 600, "flex": 1}
                                        )
                                        mui.Chip(
                                            label=style["label"],
                                            size="small",
                                            icon=getattr(mui.icon, style["icon"].title().replace("_", ""), mui.icon.Label)(),
                                            sx={"bgcolor": "rgba(255,255,255,0.7)"}
                                        )

                                    # 路徑
                                    mui.Typography(
                                        f"{area} › {item.tag.product} › {item.tag.topic}",
                                        variant="caption",
                                        color="text.secondary"
                                    )

                                    # Narrative（如果有）
                                    if item.narrative:
                                        mui.Typography(
                                            item.narrative[:80] + ("..." if len(item.narrative) > 80 else ""),
                                            variant="body2",
                                            sx={"mt": 1, "color": "text.secondary"}
                                        )

                                # 操作按鈕
                                with mui.CardActions(sx={"justifyContent": "flex-end", "pt": 0}):
                                    mui.IconButton(
                                        mui.icon.OpenInNew(),
                                        size="small",
                                        onClick=sync(f"view_{item.id}")
                                    )
                                    mui.IconButton(
                                        mui.icon.DriveFileMove(),
                                        size="small",
                                        onClick=sync(f"move_{item.id}")
                                    )

    # ===== 處理事件回調 =====
    # 檢查 session state 中的事件
    for key in list(st.session_state.keys()):
        if key.startswith("select_area_"):
            area = key.replace("select_area_", "")
            if st.session_state.selected_area == area:
                st.session_state.selected_area = None
            else:
                st.session_state.selected_area = area
            st.session_state.selected_product = None
            del st.session_state[key]
            st.rerun()

        elif key.startswith("select_prod_"):
            parts = key.replace("select_prod_", "").split("_", 1)
            if len(parts) == 2:
                area, product = parts
                st.session_state.selected_area = area
                st.session_state.selected_product = product
            del st.session_state[key]
            st.rerun()

        elif key == "show_all":
            st.session_state.selected_area = None
            st.session_state.selected_product = None
            del st.session_state[key]
            st.rerun()

        elif key == "open_input":
            del st.session_state[key]
            st.session_state.step = 'act1'
            st.rerun()

        elif key.startswith("move_"):
            task_id = key.replace("move_", "")
            # 找到對應的任務
            for item in items:
                if str(item.id) == task_id:
                    st.session_state.moving_task = item
                    st.session_state.move_dialog_open = True
                    break
            del st.session_state[key]
            st.rerun()

    # ===== 移動對話框 =====
    if st.session_state.move_dialog_open and st.session_state.moving_task:
        task = st.session_state.moving_task

        st.markdown("---")
        st.subheader(f"🔀 移動「{task.title}」")

        col1, col2 = st.columns(2)
        with col1:
            target_area = st.selectbox(
                "目標身分 (Area)",
                options=sorted(all_areas),
                key="move_target_area"
            )
        with col2:
            # 獲取目標 Area 下的 Products
            existing_products = list(tree.get(target_area, {}).keys()) if target_area in tree else []
            product_options = existing_products + ["（新增資產）"]
            selected_product = st.selectbox(
                "目標資產 (Product)",
                options=product_options,
                key="move_target_product_select"
            )
            if selected_product == "（新增資產）":
                target_product = st.text_input(
                    "新資產名稱",
                    placeholder="輸入新的 Product 名稱",
                    key="move_new_product"
                )
            else:
                target_product = selected_product

        col_cancel, col_confirm = st.columns(2)
        with col_cancel:
            if st.button("取消", use_container_width=True):
                st.session_state.move_dialog_open = False
                st.session_state.moving_task = None
                st.rerun()
        with col_confirm:
            if st.button("確認移動", type="primary", use_container_width=True):
                if target_product:
                    instruction = f"把「{task.title}」移動到「{target_area}」身分下的「{target_product}」資產中"
                else:
                    instruction = f"把「{task.title}」移動到「{target_area}」身分下"

                with st.spinner("移動中..."):
                    try:
                        run_sync(librarian.execute_governance_instruction(
                            instruction, st.session_state.user_id
                        ))
                        st.session_state.full_library = run_sync(
                            librarian.get_full_library(st.session_state.user_id)
                        )
                        st.session_state.move_dialog_open = False
                        st.session_state.moving_task = None
                        st.success(f"已移動到 {target_area}" + (f" › {target_product}" if target_product else ""))
                        st.rerun()
                    except Exception as e:
                        st.error(f"移動失敗: {e}")

    st.divider()

    # --- CONSOLE ---
    st.markdown("### 🧘 Zentropy Console")

    with st.form("console_form", clear_on_submit=True):
        col_input, col_mode, col_btn = st.columns([6, 2, 1])
        with col_input:
            user_input = st.text_input(
                "快速輸入",
                placeholder="輸入任何想法，AI 會自動分類...",
                label_visibility="collapsed"
            )
        with col_mode:
            mode = st.selectbox(
                "模式",
                ["🌱 吸收", "🛠 治理"],
                label_visibility="collapsed"
            )
        with col_btn:
            submitted = st.form_submit_button("→", type="primary")

    if submitted and user_input:
        if "吸收" in mode:
            with st.spinner("AI 正在分類..."):
                try:
                    run_sync(librarian.structure_chaos(user_input, st.session_state.user_id))
                    st.session_state.full_library = run_sync(librarian.get_full_library(st.session_state.user_id))
                    st.success("✅ 已加入看板")
                    st.rerun()
                except Exception as e:
                    st.error(f"失敗: {e}")
        else:
            with st.spinner("執行治理指令..."):
                try:
                    msg = run_sync(librarian.execute_governance_instruction(user_input, st.session_state.user_id))
                    st.session_state.full_library = run_sync(librarian.get_full_library(st.session_state.user_id))
                    st.success(msg)
                    st.rerun()
                except Exception as e:
                    st.error(f"失敗: {e}")

# Main Router
if not st.session_state.user_alias:
    # 歡迎頁面 - 引導用戶設置名字
    st.title("🌌 歡迎來到 Naruvia")
    st.markdown("### Information Entropy Reduction System")

    st.markdown("---")

    st.markdown("""
    Naruvia 幫你把腦中混亂的想法，自動整理成清晰的行動計畫。

    **你可以達成**：
    - 💭 隨時記錄想法，不再遺漏重要事項
    - 🤖 AI 自動分類，告別混亂的筆記本
    - 🎯 聚焦當下重要的事，減少決策疲勞
    """)

    st.markdown("---")
    st.info("👈 請先在左側邊欄輸入你的名字，讓我們開始吧！")

elif st.session_state.step == 'onboarding':
    onboarding_identity_setup()
elif st.session_state.step == 'act1':
    act1_chaos()
elif st.session_state.step == 'act3':
    act3_clarity()
elif st.session_state.step == 'dashboard':
    dashboard_view()

