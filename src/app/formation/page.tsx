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

export default function FormationPage() {
  const { userKey, ready, clearUserKey } = useUserKey();

  const [formationId, setFormationId] = useState<number | null>(null);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [slots, setSlots] = useState<Record<SlotPosition, SlotState>>({
    leader: { officerId: null, inherit1Id: null, inherit2Id: null },
    sub1: { officerId: null, inherit1Id: null, inherit2Id: null },
    sub2: { officerId: null, inherit1Id: null, inherit2Id: null },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 初期ロード：所持武将 / 所持戦法 / 既存編成を読み込み
  useEffect(() => {
    if (!ready) return;
    if (!userKey) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // 1. 所持武将のID取得
      const { data: userOfficers, error: uoError } = await supabase
        .from("user_officers")
        .select("officer_id")
        .eq("user_key", userKey)
        .eq("owned", true);

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

      // 2. 所持戦法のID取得（count > 0）
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

      const skillIds = (userSkills || []).map((s) => s.skill_id);
      let ownedSkills: Skill[] = [];
      if (skillIds.length > 0) {
        const { data: skillsData, error: sError } = await supabase
          .from("skills")
          .select("id, name, category")
          .in("id", skillIds)
          .order("name", { ascending: true });

        if (sError) {
          alert("skills取得エラー: " + sError.message);
          setLoading(false);
          return;
        }
        ownedSkills = (skillsData || []) as Skill[];
      }

      setSkills(ownedSkills);

      // 3. 既存の「編成1」があれば読み込み
      const { data: formations, error: fError } = await supabase
        .from("formations")
        .select("id, label")
        .eq("user_key", userKey)
        .eq("label", "編成1")
        .limit(1);

      if (fError) {
        alert("formations取得エラー: " + fError.message);
        setLoading(false);
        return;
      }

      if (formations && formations.length > 0) {
        const f = formations[0];
        setFormationId(f.id);

        // スロット読み込み
        const { data: slotRows, error: fsError } = await supabase
          .from("formation_slots")
          .select(
            "position, officer_id, inherit_skill1_id, inherit_skill2_id"
          )
          .eq("formation_id", f.id);

        if (fsError) {
          alert("formation_slots取得エラー: " + fsError.message);
          setLoading(false);
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

      setLoading(false);
    };

    fetchData();
  }, [ready, userKey]);

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

    // 1. formations を upsert（編成1）
    let currentFormationId = formationId;
    const formationRow = {
      id: formationId ?? undefined,
      user_key: userKey,
      label: "編成1",
    };

    const { data: upserted, error: upError } = await supabase
      .from("formations")
      .upsert(formationRow)
      .select("id")
      .limit(1);

    if (upError) {
      alert("formations保存エラー: " + upError.message);
      setSaving(false);
      return;
    }

    if (upserted && upserted.length > 0) {
      currentFormationId = upserted[0].id;
      setFormationId(currentFormationId);
    }

    if (!currentFormationId) {
      alert("formationsのID取得に失敗しました");
      setSaving(false);
      return;
    }

    // 2. 既存スロットを削除
    const { error: delError } = await supabase
      .from("formation_slots")
      .delete()
      .eq("formation_id", currentFormationId);

    if (delError) {
      alert("古いスロット削除エラー: " + delError.message);
      setSaving(false);
      return;
    }

    // 3. 新しいスロットを挿入
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

    alert("編成を保存しました！");
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
    return <div className="p-4">読み込み中...</div>;
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">編成1 作成</h1>

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

    <div className="mb-2 flex gap-4 text-sm">
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


      <p className="text-sm text-gray-600">
        所持している武将だけが選択肢に出ます。伝承戦法は、所持枚数が1枚以上のものだけ表示しています。
      </p>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {saving ? "保存中..." : "この編成を保存"}
      </button>

      <div className="grid gap-4 md:grid-cols-3">
        {POSITIONS.map(({ key, label }) => {
          const slot = slots[key];
          const officer = officers.find((o) => o.id === slot.officerId);

          return (
            <div key={key} className="border rounded p-3 space-y-2">
              <h2 className="font-bold mb-1">{label}</h2>

              {/* 武将選択 */}
              <div>
                <label className="text-sm block mb-1">武将</label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={slot.officerId ?? ""}
                  onChange={(e) =>
                    handleChangeOfficer(key, e.target.value)
                  }
                >
                  <option value="">-- 未選択 --</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}（★{o.rarity} / {o.faction}）
                    </option>
                  ))}
                </select>
              </div>

              {/* 固有戦法表示（読み取り専用） */}
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
                  onChange={(e) =>
                    handleChangeSkill(key, 1, e.target.value)
                  }
                >
                  <option value="">-- なし --</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}（{s.category}）
                    </option>
                  ))}
                </select>
              </div>

              {/* 伝承戦法2 */}
              <div>
                <label className="text-sm block mb-1">伝承戦法2</label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={slot.inherit2Id ?? ""}
                  onChange={(e) =>
                    handleChangeSkill(key, 2, e.target.value)
                  }
                >
                  <option value="">-- なし --</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}（{s.category}）
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
