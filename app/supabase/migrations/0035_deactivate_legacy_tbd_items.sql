-- 0035 停用「舊資料-XXX」與「(待補) XXX」service_items
-- 動機：這兩組是當初資料遷移的種子項，會出現在新建單/師傅換品項的選單造成困擾。
--   - OLD-*（舊資料）：~2 萬筆歷史匯入訂單仍掛在上面，不能刪；設 active=false 即可
--     從選單消失。顯示用關聯查詢、不看 active，所以歷史訂單照常顯示品名。
--   - TBD-*（待補，價格 0）：0 筆使用，已被「簡易品項(is_basic_choice)」流程取代。
-- 可逆：日後要恢復只需把 active 設回 true。
update public.service_items
set active = false
where code like 'OLD-%' or code like 'TBD-%';
