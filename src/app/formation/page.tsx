"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserKey } from "@/hooks/useUserKey";

type Officer = {
  id: number;
  name: string;
  rarity: number;
  faction: string | null;
  inherent_skill_name: string | null;
};

type Skill = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  inherit1_name: string | null;
  inherit2_name: string | null;
  trigger_rate?: number | null;
  isOwned: boolean;
  isInheritable: boolean;
};

type SlotPosition = "leader" | "sub1" | "sub2";

type SlotState = {
  officerId: number | null;
  inherit1Id: number | null;
  inherit2Id: number | null;
};

const POSITIONS: { key: SlotPosition; label: string }[] = [
  { key: "leader", label: "主将" },
  { key: "sub1", label: "副将1" },
  { key: "sub2", label: "副将2" },
];

const EMPTY_SLOTS: Record<SlotPosition, SlotState> = {
  leader: { officerId: null, inherit1Id: null, inherit2Id: null },
  sub1: { officerId: null, inherit1Id: null, inherit2Id: null },
  sub2: { officerId: null, inherit1Id: null, inherit2Id: null },
};

// 編成の最大数
const MAX_FORMATIONS = 5;

export default function FormationPage() {
  const { userKey, ready, clearUserKey } = useUserKey();

  const [currentLabel, setCurrentLabel] = useState<string>("編成1");
  const [formationId, setFormationId] = useState<number | null>(null);

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [slots, setSlots] = useState<Record<SlotPosition, SlotState>>(
    EMPTY_SLOTS
  );

  const [loading, setLoading] = useState(true);
  const [formationLoading, setFormationLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ユーザーが持っている編成ラベル一覧
  const [knownLabels, setKnownLabels] = useState<string[]>(["編成1"]);

  // 戦法詳細用
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);

  // 最初に「所持武将」「使える戦法」「編成一覧」のマスタを読込
  useEffect(() => {
    if (!ready) return;
    if (!userKey) {
      setLoading(false);
      return;
    }

    const fetchMaster = async () => {
      setLoading(true);

      // 1. 所持武将
      const { data: userOfficers, error: uoError } = await supabase
        .from("user_officers")
        .select("officer_id")
        .eq("user_key", userKey)
        .gt("count", 0); // count > 0 を所持とみなす

      if (uoError) {
        alert("user_officers取得エラー: " + uoError.message);
        setLoading(false);
        return;
      }

      const officerIds = (userOfficers || []).map((u) => u.officer_id);

      let ownedOfficers: Officer[] = [];
      if (officerIds.length > 0) {
        const { data: officersData, error: oError } = await supabase
          .from("officers")
          .select("id, name, rarity, faction, inherent_skill_name")
          .in("id", officerIds)
          .order("rarity", { ascending: false })
          .order("name", { ascending: true });

        if (oError) {
          alert("officers取得エラー: " + oError.message);
          setLoading(false);
          return;
        }
        ownedOfficers = (officersData || []) as Officer[];
      }
      setOfficers(ownedOfficers);

      const ownedOfficerNames = ownedOfficers.map((o) => o.name);

      // 2. 所持戦法（カードとして）
      const { data: userSkills, error: usError } = await supabase
        .from("user_skills")
        .select("skill_id, count")
        .eq("user_id", userKey)
        .gt("count", 0);

      if (usError) {
        alert("user_skills取得エラー: " + usError.message);
        setLoading(false);
        return;
      }

      const ownedSkillIds = new Set(
        (userSkills || []).map((s) => s.skill_id as number)
      );

      // 3. skills 全体（owner_name が NULL = 固有ではない戦法）
      const { data: skillsData, error: sError } = await supabase
        .from("skills")
        .select(
          "id, name, category, description, inherit1_name, inherit2_name, trigger_rate, owner_name"
        )
        .is("owner_name", null)
        .order("name", { ascending: true });

      if (sError) {
        alert("skills取得エラー: " + sError.message);
        setLoading(false);
        return;
      }

      const usableSkills: Skill[] = (skillsData || [])
        .map((row: any) => {
          const isOwned = ownedSkillIds.has(row.id);
          const isInheritable =
            (row.inherit1_name &&
              ownedOfficerNames.includes(row.inherit1_name)) ||
            (row.inherit2_name &&
              ownedOfficerNames.includes(row.inherit2_name));

          return {
            id: row.id,
            name: row.name,
            category: row.category,
            description: row.description,
            inherit1_name: row.inherit1_name,
            inherit2_name: row.inherit2_name,
            trigger_rate: row.trigger_rate,
            isOwned,
            isInheritable,
          } as Skill;
        })
        // 所持 or 伝承者を持っているものだけ候補にする
        .filter((s) => s.isOwned || s.isInheritable);

      setSkills(usableSkills);

      // 4. このユーザーの編成一覧を取得
      const { data: formationRows, error: formError } = await supabase
        .from("formations")
        .select("label")
        .eq("user_key", userKey);

      if (formError) {
        alert("formations一覧取得エラー: " + formError.message);
        setLoading(false);
        return;
      }

      let labels = Array.from(
        new Set((formationRows || []).map((r) => r.label as string))
      );

      // ラベルがなければ編成1を作っておくイメージ
      if (labels.length === 0) {
        labels = ["編成1"];
      } else {
        // 編成1, 編成2, ... の順にソートしておく
        labels.sort((a, b) => {
          const na = parseInt(a.replace("編成", ""), 10);
          const nb = parseInt(b.replace("編成", ""), 10);
          if (Number.isNaN(na) || Number.isNaN(nb)) {
            return a.localeCompare(b);
          }
          return na - nb;
        });
      }

      setKnownLabels(labels);
      setLoading(false);

      // 一番最初の編成をロード
      await loadFormation(labels[0]);
    };

    fetchMaster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userKey]);

  // 指定ラベルの編成をロード
  const loadFormation = async (label: string) => {
    if (!userKey) return;
    setFormationLoading(true);
    setCurrentLabel(label);
    setFormationId(null);
    setSlots(EMPTY_SLOTS);

    const { data: formations, error: fError } = await supabase
      .from("formations")
      .select("id, label")
      .eq("user_key", userKey)
      .eq("label", label)
      .limit(1);

    if (fError) {
      alert("formations取得エラー: " + fError.message);
      setFormationLoading(false);
      return;
    }

    if (formations && formations.length > 0) {
      const f = formations[0];
      setFormationId(f.id);

      const { data: slotRows, error: fsError } = await supabase
        .from("formation_slots")
        .select(
          "position, officer_id, inherit_skill1_id, inherit_skill2_id"
        )
        .eq("formation_id", f.id);

      if (fsError) {
        alert("formation_slots取得エラー: " + fsError.message);
        setFormationLoading(false);
        return;
      }

      const newSlots: Record<SlotPosition, SlotState> = {
        leader: { officerId: null, inherit1Id: null, inherit2Id: null },
        sub1: { officerId: null, inherit1Id: null, inherit2Id: null },
        sub2: { officerId: null, inherit1Id: null, inherit2Id: null },
      };

      (slotRows || []).forEach((row) => {
        const pos = row.position as SlotPosition;
        if (pos in newSlots) {
          newSlots[pos] = {
            officerId: row.officer_id,
            inherit1Id: row.inherit_skill1_id,
            inherit2Id: row.inherit_skill2_id,
          };
        }
      });

      setSlots(newSlots);
    }

    setFormationLoading(false);
  };

  // ＋ボタンで新しい編成タブを追加
  const handleAddFormation = () => {
    if (knownLabels.length >= MAX_FORMATIONS) {
      alert(`編成は最大 ${MAX_FORMATIONS} 個までです。`);
      return;
    }

    // 既存ラベルから番号を抽出して、空いている最小の番号を探す
    const usedIndices = knownLabels
      .map((lbl) => parseInt(lbl.replace("編成", ""), 10))
      .filter((n) => !Number.isNaN(n));

    let nextIndex = 1;
    while (usedIndices.includes(nextIndex)) {
      nextIndex += 1;
    }

    const newLabel = `編成${nextIndex}`;
    setKnownLabels((prev) => [...prev, newLabel]);
    // 新しい編成（まだDBには無いので空の状態）をロード
    loadFormation(newLabel);
  };

  const handleChangeOfficer = (position: SlotPosition, officerIdStr: string) => {
    const officerId = officerIdStr ? Number(officerIdStr) : null;
    setSlots((prev) => ({
      ...prev,
      [position]: {
        ...prev[position],
        officerId,
      },
    }));
  };

  const handleChangeSkill = (
    position: SlotPosition,
    index: 1 | 2,
    skillIdStr: string
  ) => {
    const skillId = skillIdStr ? Number(skillIdStr) : null;
    setSlots((prev) => ({
      ...prev,
      [position]: {
        ...prev[position],
        ...(index === 1 ? { inherit1Id: skillId } : { inherit2Id: skillId }),
      },
    }));
  };

  const handleSave = async () => {
    if (!userKey) {
      alert("先にユーザー名を選択してください");
      return;
    }

    setSaving(true);

    // formations を upsert（現在のラベル）
    let currentFormationId = formationId ?? undefined;
    const formationRow = {
      id: currentFormationId,
      user_key: userKey,
      label: currentLabel,
    };

    const { data: upserted, error: upError } = await supabase
      .from("formations")
      .upsert(formationRow)
      .select("id")
      .limit(1);

if (upserted && upserted.length > 0) {
  const newId = upserted[0].id ?? null; // number | null に変換
  currentFormationId = newId;
  setFormationId(newId);
}

    if (upserted && upserted.length > 0) {
      currentFormationId = upserted[0].id;
      setFormationId(currentFormationId ?? null);
    }

    if (!currentFormationId) {
      alert("formationsのID取得に失敗しました");
      setSaving(false);
      return;
    }

    // 既存スロット削除
    const { error: delError } = await supabase
      .from("formation_slots")
      .delete()
      .eq("formation_id", currentFormationId);

    if (delError) {
      alert("古いスロット削除エラー: " + delError.message);
      setSaving(false);
      return;
    }

    // スロット挿入
    const insertRows = POSITIONS.flatMap(({ key }) => {
      const s = slots[key];
      if (!s.officerId) return [];
      return [
        {
          formation_id: currentFormationId,
          position: key,
          officer_id: s.officerId,
          inherit_skill1_id: s.inherit1Id,
          inherit_skill2_id: s.inherit2Id,
        },
      ];
    });

    if (insertRows.length === 0) {
      alert("少なくとも1人は武将を選んでください");
      setSaving(false);
      return;
    }

    const { error: insError } = await supabase
      .from("formation_slots")
      .insert(insertRows);

    if (insError) {
      alert("formation_slots保存エラー: " + insError.message);
      setSaving(false);
      return;
    }

    alert(`${currentLabel} を保存しました！`);
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
    return <div className="p-4">マスタデータ読み込み中...</div>;
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">編成作成</h1>

      <div className="text-sm text-gray-600">
        ユーザー: <strong>{userKey}</strong>{" "}
        <button
          className="ml-2 underline"
          onClick={() => {
            clearUserKey();
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
          }}
        >
          別ユーザーに切り替え
        </button>
      </div>

      {/* メニュー */}
      <div className="mb-2 flex gap-4 text-sm">
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

      {/* 編成タブ（＋ボタン付き） */}
      <div className="flex items-center gap-2 mb-2">
        {knownLabels.map((label) => (
          <button
            key={label}
            type="button"
            className={`px-3 py-1 rounded border text-sm ${
              currentLabel === label
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-700 border-gray-300"
            }`}
            onClick={() => loadFormation(label)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="px-3 py-1 rounded border text-sm bg-white text-blue-600 border-blue-400"
          onClick={handleAddFormation}
          title="編成を追加"
        >
          ＋
        </button>
      </div>

      {formationLoading && (
        <div className="text-sm text-gray-500">編成読み込み中...</div>
      )}

      <p className="text-sm text-gray-600">
        ・所持している武将だけが選択肢に出ます。
        <br />
        ・伝承戦法は、「所持している戦法」＋「伝承者を所持している戦法」が選べます。
        （所持:カードとして持っている / 伝承可:伝承者を持っている）
      </p>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {saving ? "保存中..." : `${currentLabel} を保存`}
      </button>

      <div className="grid gap-4 md:grid-cols-3 mt-4">
        {POSITIONS.map(({ key, label }) => {
          const slot = slots[key];
          const officer = officers.find((o) => o.id === slot.officerId);
          const inheritSkill1 = skills.find((s) => s.id === slot.inherit1Id);
          const inheritSkill2 = skills.find((s) => s.id === slot.inherit2Id);

          const renderSkillLabel = (s: Skill) => {
            const flags = [
              s.isOwned ? "所持" : null,
              s.isInheritable ? "伝承可" : null,
            ]
              .filter(Boolean)
              .join("/");

            return `${s.name}（${s.category ?? "種類不明"}・${flags}）`;
          };

          return (
            <div key={key} className="border rounded p-3 space-y-2">
              <h2 className="font-bold mb-1">{label}</h2>

              {/* 武将選択 */}
              <div>
                <label className="text-sm block mb-1">武将</label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={slot.officerId ?? ""}
                  onChange={(e) => handleChangeOfficer(key, e.target.value)}
                >
                  <option value="">-- 未選択 --</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}（★{o.rarity} / {o.faction}）
                    </option>
                  ))}
                </select>
              </div>

              {/* 固有戦法（表示のみ） */}
              <div className="text-sm">
                <span className="font-semibold">固有戦法: </span>
                {officer?.inherent_skill_name || "-"}
              </div>

              {/* 伝承戦法1 */}
              <div>
                <label className="text-sm block mb-1">伝承戦法1</label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={slot.inherit1Id ?? ""}
                  onChange={(e) => handleChangeSkill(key, 1, e.target.value)}
                >
                  <option value="">-- なし --</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {renderSkillLabel(s)}
                    </option>
                  ))}
                </select>
                {inheritSkill1 && (
                  <div className="mt-1 text-right">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 border rounded bg-white hover:bg-blue-50"
                      onClick={() => setDetailSkill(inheritSkill1)}
                    >
                      詳細
                    </button>
                  </div>
                )}
              </div>

              {/* 伝承戦法2 */}
              <div>
                <label className="text-sm block mb-1">伝承戦法2</label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={slot.inherit2Id ?? ""}
                  onChange={(e) => handleChangeSkill(key, 2, e.target.value)}
                >
                  <option value="">-- なし --</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {renderSkillLabel(s)}
                    </option>
                  ))}
                </select>
                {inheritSkill2 && (
                  <div className="mt-1 text-right">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 border rounded bg-white hover:bg-blue-50"
                      onClick={() => setDetailSkill(inheritSkill2)}
                    >
                      詳細
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 戦法詳細モーダル */}
      {detailSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDetailSkill(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-4 w-[90vw] max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">{detailSkill.name}</h2>

            <div className="text-sm space-y-1 mb-3">
              <div>種類: {detailSkill.category ?? "-"}</div>
              {detailSkill.trigger_rate != null && (
                <div>発動率: {detailSkill.trigger_rate}%</div>
              )}
              <div>
                状態:{" "}
                {[
                  detailSkill.isOwned ? "所持" : null,
                  detailSkill.isInheritable ? "伝承可" : null,
                ]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </div>
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
                onClick={() => setDetailSkill(null)}
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
