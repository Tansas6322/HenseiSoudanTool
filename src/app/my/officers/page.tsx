"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserKey } from "@/hooks/useUserKey";

type Officer = {
  id: number;
  name: string;
  rarity: number; // ★
  cost_raw: number | null; // コスト
  faction: string | null; // 勢力
  house: string | null; // 家門

  // ▼ officersテーブルのカラム
  inherent_skill_name: string | null; // 固有戦法名
  inherent_skill_type: string | null; // 固有戦法の種別（指揮/能動/受動…）
  inherit_skill_name: string | null; // 伝承戦法名
  unique_trait: string | null; // 固有特性
  trait凸1: string | null;
  trait凸3: string | null;
  trait凸5: string | null;
};

type UserOfficer = {
  officer_id: number;
  count: number | null;
};

// skillsテーブルから取ってくる内容
type SkillSummary = {
  name: string;
  description: string | null;
};

export default function MyOfficersPage() {
  const { userKey, ready, clearUserKey } = useUserKey();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [countMap, setCountMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ▼ 詳細モーダル関連
  const [detailOfficer, setDetailOfficer] = useState<Officer | null>(null);
  const [detailSkills, setDetailSkills] = useState<
    Record<string, SkillSummary>
  >({});
  const [detailSkillsLoading, setDetailSkillsLoading] = useState(false);

  // フィルター用の state
  const [search, setSearch] = useState("");
  const [filterRarity, setFilterRarity] = useState<string>(""); // ★
  const [filterCost, setFilterCost] = useState<string>(""); // コスト
  const [filterFaction, setFilterFaction] = useState<string>(""); // 勢力

  // ソート用
  const [sortType, setSortType] = useState<string>("");

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
        // 型推論を any にして ParserError を回避
        .select<any>(
          `
          id,
          name,
          rarity,
          cost_raw,
          faction,
          house,
          inherent_skill_name,
          inherent_skill_type,
          inherit_skill_name,
          unique_trait,
          trait凸1,
          trait凸3,
          trait凸5
        `
        )
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

      // 安全側に倒して unknown 経由でキャスト
      setOfficers((officersData ?? []) as unknown as Officer[]);
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

  // 詳細モーダルを開く時に戦法説明も読み込み
  const openDetail = async (officer: Officer) => {
    setDetailOfficer(officer);
    setDetailSkills({});

    if (!officer.inherent_skill_name && !officer.inherit_skill_name) return;

    const names = [
      officer.inherent_skill_name,
      officer.inherit_skill_name,
    ].filter((v): v is string => !!v);

    if (names.length === 0) return;

    setDetailSkillsLoading(true);

    const { data, error } = await supabase
      .from("skills")
      .select("name, description")
      .in("name", names);

    if (error) {
      console.error("skills取得エラー", error);
      setDetailSkills({});
    } else {
      const map: Record<string, SkillSummary> = {};
      (data as SkillSummary[] | null)?.forEach((s) => {
        map[s.name] = s;
      });
      setDetailSkills(map);
    }

    setDetailSkillsLoading(false);
  };

  const closeDetail = () => {
    setDetailOfficer(null);
    setDetailSkills({});
    setDetailSkillsLoading(false);
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

  const costOptions = Array.from(
    new Set(
      officers.map((o) => o.cost_raw).filter((v): v is number => v != null)
    )
  ).sort((a, b) => a - b);

  const factionOptions = Array.from(
    new Set(
      officers.map((o) => o.faction).filter((v): v is string => !!v)
    )
  ).sort();

  // 検索 & フィルター適用
  const filteredOfficers = officers.filter((o) => {
    if (search && !o.name.includes(search)) return false;
    if (filterRarity && o.rarity !== Number(filterRarity)) return false;
    if (filterCost && o.cost_raw !== Number(filterCost)) return false;
    if (filterFaction && o.faction !== filterFaction) return false;
    return true;
  });

  // ソート適用
  const sortedOfficers = [...filteredOfficers];
  sortedOfficers.sort((a, b) => {
    switch (sortType) {
      case "rarity_desc":
        return b.rarity - a.rarity;
      case "rarity_asc":
        return a.rarity - b.rarity;
      case "cost_desc":
        return (b.cost_raw ?? 0) - (a.cost_raw ?? 0);
      case "cost_asc":
        return (a.cost_raw ?? 0) - (b.cost_raw ?? 0);
      default:
        return 0;
    }
  });

  // 表示中の武将を一括で 1枚所持 / 未所持 にする
  const handleSelectFiltered = () => {
    setCountMap((prev) => {
      const next = { ...prev };
      filteredOfficers.forEach((o) => {
        const current = prev[o.id] ?? 0;
        // まだ0枚なら 1枚にする（すでに複数枚持っている場合はそのまま）
        next[o.id] = current > 0 ? current : 1;
      });
      return next;
    });
  };

  const handleClearFiltered = () => {
    setCountMap((prev) => {
      const next = { ...prev };
      filteredOfficers.forEach((o) => {
        next[o.id] = 0;
      });
      return next;
    });
  };

  // 特性をまとめて1本の文字列にするヘルパー
  const buildTraitsText = (officer: Officer) => {
    const list = [officer.trait凸1, officer.trait凸3, officer.trait凸5].filter(
      (v): v is string => !!v
    );
    return list.length ? list.join(" / ") : "-";
  };

  const getSkillDescription = (name: string | null) => {
    if (!name) return null;
    const skill = detailSkills[name];
    return skill?.description ?? null;
  };

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
            value={filterCost}
            onChange={(e) => setFilterCost(e.target.value)}
          >
            <option value="">全部</option>
            {costOptions.map((c) => (
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

        {/* ソート */}
        <div className="flex items-center gap-1">
          <span>ソート:</span>
          <select
            className="border rounded px-2 py-1"
            value={sortType}
            onChange={(e) => setSortType(e.target.value)}
          >
            <option value="">なし</option>
            <option value="rarity_desc">★ 高い順</option>
            <option value="rarity_asc">★ 低い順</option>
            <option value="cost_desc">コスト 高い順</option>
            <option value="cost_asc">コスト 低い順</option>
          </select>
        </div>
      </div>

      {/* 一括操作ボタン */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={handleSelectFiltered}
          className="px-3 py-1 rounded border bg-white hover:bg-blue-50"
        >
          表示中の武将をすべて1枚所持にする
        </button>
        <button
          type="button"
          onClick={handleClearFiltered}
          className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
        >
          表示中の武将をすべて未所持にする
        </button>
        <span className="text-gray-500">
          （フィルター・検索で絞り込んだ結果にだけ適用されます）
        </span>
      </div>

      {/* 武将カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
        {sortedOfficers.map((o) => {
          const count = countMap[o.id] ?? 0;
          const owned = count > 0;

          const officerImageSrc = `/officers/${o.id}.png`;

          return (
            <div
              key={o.id}
              className={`border rounded p-2 flex flex-col gap-1 ${
                owned ? "bg-blue-100 border-blue-400" : "bg-white"
              }`}
            >
              <div className="flex gap-2">
                <img
                  src={officerImageSrc}
                  alt={o.name}
                  width={64}
                  height={64}
                  className="rounded object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/no-image.png";
                  }}
                />

                <div className="flex-1">
                  <div className="font-bold">{o.name}</div>
                  <div>★{o.rarity}</div>
                  <div>コスト: {o.cost_raw ?? "-"}</div>
                  <div>
                    {o.faction ?? "-"} / {o.house ?? "-"}
                  </div>
                </div>
              </div>

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

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-xs px-2 py-1 border rounded bg-white/70 hover:bg-blue-50"
                  onClick={() => openDetail(o)}
                >
                  詳細
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 詳細モーダル */}
      {detailOfficer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-4 w-[90vw] max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">{detailOfficer.name}</h2>

            <div className="text-sm space-y-1 mb-3">
              <div>★{detailOfficer.rarity}</div>
              <div>
                コスト: {detailOfficer.cost_raw ?? "-"} /{" "}
                {detailOfficer.faction ?? "-"} / {detailOfficer.house ?? "-"}
              </div>
            </div>

            {detailSkillsLoading && (
              <div className="text-xs text-gray-500 mb-2">
                戦法の説明を読み込み中…
              </div>
            )}

            <div className="text-sm space-y-3">
              <div>
                <div>
                  <span className="font-semibold">固有戦法:</span>{" "}
                  {detailOfficer.inherent_skill_name ?? "-"}{" "}
                  {detailOfficer.inherent_skill_type &&
                    `（${detailOfficer.inherent_skill_type}）`}
                </div>
                {detailOfficer.inherent_skill_name && (
                  <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                    {getSkillDescription(detailOfficer.inherent_skill_name) ??
                      "（説明未登録）"}
                  </p>
                )}
              </div>

              <div>
                <div>
                  <span className="font-semibold">伝承戦法:</span>{" "}
                  {detailOfficer.inherit_skill_name ?? "-"}
                </div>
                {detailOfficer.inherit_skill_name && (
                  <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                    {getSkillDescription(detailOfficer.inherit_skill_name) ??
                      "（説明未登録）"}
                  </p>
                )}
              </div>

              <div>
                <span className="font-semibold">固有特性:</span>{" "}
                {detailOfficer.unique_trait ?? "-"}
              </div>
              <div>
                <span className="font-semibold">特性:</span>{" "}
                {buildTraitsText(detailOfficer)}
              </div>
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
