"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserKey } from "@/hooks/useUserKey";

type Skill = {
  id: number;
  name: string;
  category: string | null;
  trigger_rate: number | null;
  owner_name: string | null; // 固有戦法判定用
  // ▼ 詳細表示用
  description: string | null;
  inherit1_name: string | null;
  inherit2_name: string | null;
};

type UserSkill = {
  skill_id: number;
  count: number;
};

export default function MySkillsPage() {
  const { userKey, ready, clearUserKey } = useUserKey();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [ownedMap, setOwnedMap] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [search, setSearch] = useState("");

  // 詳細モーダル用
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!userKey) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // skills 読み込み（owner_name != null = 固有戦法 を除外）
      const { data: skillsData, error: skillsError } = await supabase
        .from("skills")
        .select(
          `
          id,
          name,
          category,
          trigger_rate,
          owner_name,
          description,
          inherit1_name,
          inherit2_name
        `
        )
        .is("owner_name", null)
        .order("name", { ascending: true });

      if (skillsError) {
        alert("skills取得エラー: " + skillsError.message);
        setLoading(false);
        return;
      }

      // user_skills 読み込み（count > 0 なら所持とみなす）
      const { data: userSkills, error: userSkillsError } = await supabase
        .from("user_skills")
        .select("skill_id, count")
        .eq("user_id", userKey);

      if (userSkillsError) {
        alert("user_skills取得エラー: " + userSkillsError.message);
        setLoading(false);
        return;
      }

      const map: Record<number, boolean> = {};
      (userSkills as UserSkill[] | null)?.forEach((u) => {
        map[u.skill_id] = (u.count ?? 0) > 0;
      });

      setSkills((skillsData || []) as Skill[]);
      setOwnedMap(map);
      setLoading(false);
    };

    fetchData();
  }, [ready, userKey]);

  // チェック切り替え
  const toggleOwned = (skillId: number) => {
    setOwnedMap((prev) => ({ ...prev, [skillId]: !prev[skillId] }));
  };

  // 保存（owned → count 0/1 に変換して upsert）
  const handleSave = async () => {
    if (!userKey) {
      alert("先にユーザー名を選択してください");
      return;
    }

    setSaving(true);

    const updates = skills.map((s) => ({
      user_id: userKey,
      skill_id: s.id,
      count: ownedMap[s.id] ? 1 : 0,
    }));

    const { error } = await supabase.from("user_skills").upsert(updates);

    if (error) {
      alert("保存失敗: " + error.message);
    } else {
      alert("保存しました！");
    }

    setSaving(false);
  };

  // 表示分岐
  if (!ready) return <div className="p-4">ユーザー情報を読み込み中...</div>;

  if (!userKey) {
    return (
      <div className="p-4">
        ユーザー名が未設定です。
        <a href="/login" className="text-blue-500 underline">
          ログイン
        </a>
        してください。
      </div>
    );
  }

  if (loading) return <div className="p-4">読み込み中...</div>;

  // フィルタ処理
  const filteredSkills = skills.filter((s) => {
    if (filterCategory && s.category !== filterCategory) return false;
    if (search && !s.name.includes(search)) return false;
    return true;
  });

  const closeDetail = () => setDetailSkill(null);

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-2">所持戦法登録</h1>

      <div className="mb-4 text-sm text-gray-600">
        ユーザー: <strong>{userKey}</strong>{" "}
        <button
          className="ml-2 underline"
          onClick={() => {
            clearUserKey();
            window.location.href = "/login";
          }}
        >
          別ユーザーに切り替え
        </button>
      </div>

      {/* 共通メニュー */}
      <div className="mb-4 flex gap-4 text-sm">
        <a href="/" className="text-blue-600 underline">
          ホーム
        </a>
        <a href="/my/officers" className="text-blue-600 underline">
          武将登録
        </a>
        <a href="/my/skills" className="text-blue-600 underline">
          戦法登録
        </a>
        <a href="/formation" className="text-blue-600 underline">
          編成作成
        </a>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        {saving ? "保存中..." : "所持状況を保存"}
      </button>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <span>種類:</span>
        <select
          className="border rounded px-2 py-1"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">全部</option>
          <option value="能動">能動</option>
          <option value="指揮">指揮</option>
          <option value="受動">受動</option>
          <option value="兵種">兵種</option>
          <option value="突撃">突撃</option>
        </select>

        <span className="ml-4">検索:</span>
        <input
          className="border rounded px-2 py-1"
          placeholder="戦法名"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredSkills.map((s) => {
          const owned = !!ownedMap[s.id];
          const skillImageSrc = `/skills/${s.id}.png`;

          return (
            <div
              key={s.id}
              className={`border rounded p-2 cursor-pointer select-none ${
                owned ? "bg-blue-100 border-blue-400" : "bg-white"
              }`}
              onClick={() => toggleOwned(s.id)}
            >
              <div className="flex gap-2">
                <img
                  src={skillImageSrc}
                  alt={s.name}
                  width={48}
                  height={48}
                  className="rounded object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/no-image.png";
                  }}
                />
                <div>
                  <div className="font-bold">{s.name}</div>
                  <div className="text-sm text-gray-600">
                    {s.category} / 発動率: {s.trigger_rate ?? "-"}%
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-semibold">
                  {owned ? "✔ 所持" : "未所持"}
                </span>
                <button
                  type="button"
                  className="text-xs px-2 py-1 border rounded bg-white/70 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation(); // 所持切替には反応させない
                    setDetailSkill(s);
                  }}
                >
                  詳細
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 戦法詳細モーダル */}
      {detailSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-4 w-[90vw] max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">{detailSkill.name}</h2>

            <div className="text-sm space-y-1 mb-3">
              <div>種類: {detailSkill.category ?? "-"}</div>
              <div>発動率: {detailSkill.trigger_rate ?? "-"}%</div>
            </div>

            <div className="text-sm space-y-2 mb-3">
              <div>
                <span className="font-semibold">伝承者1:</span>{" "}
                {detailSkill.inherit1_name ?? "-"}
              </div>
              <div>
                <span className="font-semibold">伝承者2:</span>{" "}
                {detailSkill.inherit2_name ?? "-"}
              </div>
            </div>

            <div className="text-sm">
              <div className="font-semibold mb-1">説明:</div>
              <p className="text-xs text-gray-800 whitespace-pre-wrap">
                {detailSkill.description || "（説明未登録）"}
              </p>
            </div>

            <div className="mt-4 text-right">
              <button
                type="button"
                className="px-3 py-1 text-sm border rounded bg-gray-100 hover:bg-gray-200"
                onClick={closeDetail}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
