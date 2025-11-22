"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserKey } from "@/hooks/useUserKey";

type Officer = {
  id: number;
  name: string;
  rarity: number;          // ★
  cost_raw: number | null;     // コスト
  faction: string | null;  // 勢力
  house: string | null;   // 家門
};

type UserOfficer = {
  officer_id: number;
  count: number | null;
};

export default function MyOfficersPage() {
  const { userKey, ready, clearUserKey } = useUserKey();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [countMap, setCountMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // フィルター用の state
  const [search, setSearch] = useState("");
  const [filterRarity, setFilterRarity] = useState<string>("");  // ★
  const [filtercost_raw, setFiltercost_raw] = useState<string>("");      // コスト
  const [filterFaction, setFilterFaction] = useState<string>("");// 勢力

  useEffect(() => {
    if (!ready) return;
    if (!userKey) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // 武将一覧
      const { data: officersData, error: officersError } = await supabase
        .from("officers")
        .select("id, name, rarity, cost_raw, faction, house")
        .order("rarity", { ascending: false })
        .order("cost_raw", { ascending: true })
        .order("name", { ascending: true });

      if (officersError) {
        alert("officers取得エラー: " + officersError.message);
        setLoading(false);
        return;
      }

      // ユーザーの武将枚数
      const { data: userOfficers, error: userOfficersError } = await supabase
        .from("user_officers")
        .select("officer_id, count")
        .eq("user_key", userKey);

      if (userOfficersError) {
        alert("user_officers取得エラー: " + userOfficersError.message);
        setLoading(false);
        return;
      }

      const map: Record<number, number> = {};
      (userOfficers as UserOfficer[] | null)?.forEach((u) => {
        map[u.officer_id] = u.count ?? 0;
      });

      setOfficers((officersData || []) as Officer[]);
      setCountMap(map);
      setLoading(false);
    };

    fetchData();
  }, [ready, userKey]);

  // ＋ボタン
  const handleIncrement = (id: number) => {
    setCountMap((prev) => {
      const current = prev[id] ?? 0;
      return { ...prev, [id]: current + 1 };
    });
  };

  // －ボタン
  const handleDecrement = (id: number) => {
    setCountMap((prev) => {
      const current = prev[id] ?? 0;
      const next = current - 1;
      return { ...prev, [id]: next < 0 ? 0 : next };
    });
  };

  const handleSave = async () => {
    if (!userKey) {
      alert("先にユーザー名を選択してください");
      return;
    }
    setSaving(true);

    const updates = officers.map((o) => ({
      user_key: userKey,
      officer_id: o.id,
      count: countMap[o.id] ?? 0,
    }));

    const { error } = await supabase.from("user_officers").upsert(updates);

    if (error) {
      alert("保存失敗: " + error.message);
    } else {
      alert("保存しました！");
    }
    setSaving(false);
  };

  // 表示分岐
  if (!ready) {
    return <div className="p-4">ユーザー情報を読み込み中...</div>;
  }

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

  if (loading) {
    return <div className="p-4">武将データを読み込み中...</div>;
  }

  // フィルター用の選択肢を作成
  const rarityOptions = Array.from(
    new Set(officers.map((o) => o.rarity).filter((v) => v != null))
  ).sort((a, b) => b - a); // 高い★から

  const cost_rawOptions = Array.from(
    new Set(officers.map((o) => o.cost_raw).filter((v): v is number => v != null))
  ).sort((a, b) => a - b);

  const factionOptions = Array.from(
    new Set(officers.map((o) => o.faction).filter((v): v is string => !!v))
  ).sort();

  // 検索 & フィルター適用
  const filteredOfficers = officers.filter((o) => {
    const count = countMap[o.id] ?? 0;

    if (search && !o.name.includes(search)) return false;
    if (filterRarity && o.rarity !== Number(filterRarity)) return false;
    if (filtercost_raw && o.cost_raw !== Number(filtercost_raw)) return false;
    if (filterFaction && o.faction !== filterFaction) return false;

    // 例えば「0枚の武将も見たい」想定なので、count ではフィルタしない
    return true;
  });

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-2">所持武将登録</h1>

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

      {/* 検索 & フィルター */}
      <div className="mb-4 flex flex-wrap gap-3 items-center text-sm">
        <div className="flex items-center gap-1">
          <span>検索:</span>
          <input
            className="border rounded px-2 py-1"
            placeholder="武将名"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1">
          <span>★:</span>
          <select
            className="border rounded px-2 py-1"
            value={filterRarity}
            onChange={(e) => setFilterRarity(e.target.value)}
          >
            <option value="">全部</option>
            {rarityOptions.map((r) => (
              <option key={r} value={r}>
                ★{r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span>コスト:</span>
          <select
            className="border rounded px-2 py-1"
            value={filtercost_raw}
            onChange={(e) => setFiltercost_raw(e.target.value)}
          >
            <option value="">全部</option>
            {cost_rawOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span>勢力:</span>
          <select
            className="border rounded px-2 py-1"
            value={filterFaction}
            onChange={(e) => setFilterFaction(e.target.value)}
          >
            <option value="">全部</option>
            {factionOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 武将カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
        {filteredOfficers.map((o) => {
          const count = countMap[o.id] ?? 0;
          const owned = count > 0;

          return (
            <div
              key={o.id}
              className={`border rounded p-2 flex flex-col gap-1 ${
                owned ? "bg-blue-100 border-blue-400" : "bg-white"
              }`}
            >
              <div className="font-bold">{o.name}</div>
              <div>★{o.rarity}</div>
              <div>コスト: {o.cost_raw ?? "-"}</div>
              <div>{o.faction ?? "-"} / {o.house ?? "-"}</div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm">所持枚数</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDecrement(o.id)}
                    className="border rounded w-7 h-7 flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="w-6 text-center">{count}</span>
                  <button
                    type="button"
                    onClick={() => handleIncrement(o.id)}
                    className="border rounded w-7 h-7 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
