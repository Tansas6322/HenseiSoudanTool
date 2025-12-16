"use client";

import { Suspense } from "react"; 
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

const MAX_FORMATIONS = 5;

/* ========= ここからコピー機能 ========= */

async function copyToClipboard(text: string): Promise<boolean> {
  // navigator.clipboard が使える場合
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // フォールバックへ
    }
  }

  // フォールバック（古いブラウザ・非HTTPS環境など）
  if (typeof document === "undefined") return false;

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.left = "-1000px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type FormatFormationParams = {
  ownerKey: string;
  advisorLabel: string;
  label: string;
  slots: Record<SlotPosition, SlotState>;
  officers: Officer[];
  skills: Skill[];
  requestcomment: string;
  answercomment: string;
};

function formatFormationForCopy({
  ownerKey,
  advisorLabel,
  label,
  slots,
  officers,
  skills,
  requestcomment,
  answercomment,
}: FormatFormationParams): string {
  const lines: string[] = [];

  lines.push(`【${ownerKey || "（相談者未選択）"} さん宛 ${label}】`);
  if (advisorLabel) {
    lines.push(`編成者: ${advisorLabel}`);
  }
  lines.push("");

  POSITIONS.forEach(({ key, label: posLabel }) => {
    const slot = slots[key];

    const hasSomething =
      slot.officerId !== null ||
      slot.inherit1Id !== null ||
      slot.inherit2Id !== null;

    if (!hasSomething) return;

    const officer = officers.find((o) => o.id === slot.officerId);
    const inheritSkill1 = skills.find((s) => s.id === slot.inherit1Id);
    const inheritSkill2 = skills.find((s) => s.id === slot.inherit2Id);

    const parts: string[] = [];
    parts.push(`${posLabel}: ${officer ? officer.name : "（武将未設定）"}`);

    if (officer?.inherent_skill_name) {
      parts.push(`固有：${officer.inherent_skill_name}`);
    }

    const inheritNames = [
      inheritSkill1?.name ?? null,
      inheritSkill2?.name ?? null,
    ].filter(Boolean);

    if (inheritNames.length > 0) {
      parts.push(`伝授：${inheritNames.join(" / ")}`);
    }

    lines.push(`- ${parts.join(" ｜ ")}`);
  });

  if (requestcomment) {
    lines.push("", `依頼者コメント：${requestcomment}`);
  }
  if (answercomment) {
    lines.push("", `回答者コメント：${answercomment}`);
  }

  return lines.join("\n");
}

/* ========= ここまでコピー機能 ========= */

function FormationPageInner() {
  const { userKey, ready, clearUserKey } = useUserKey();
  const advisorKey = userKey; // ログインユーザー = 編成者
  const searchParams = useSearchParams();

  // 相談者関連
  const [ownerList, setOwnerList] = useState<string[]>([]);
  const [ownerKey, setOwnerKey] = useState<string>("");

  // 編成者タブ
  const [advisorList, setAdvisorList] = useState<string[]>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>("");

  // advisorKeyごとの編成ラベル一覧
  const [labelMap, setLabelMap] = useState<Record<string, string[]>>({});
  const [knownLabels, setKnownLabels] = useState<string[]>(["編成1"]);
  const [currentLabel, setCurrentLabel] = useState<string>("編成1");
  const [formationId, setFormationId] = useState<number | null>(null);

  // マスタ
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [slots, setSlots] = useState<Record<SlotPosition, SlotState>>(
    EMPTY_SLOTS
  );

  const [loading, setLoading] = useState(true);
  const [formationLoading, setFormationLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // コメント
  const [requestcomment, setRequestcomment] = useState<string>("");
  const [answercomment, setAnswercomment] = useState<string>("");

  // 戦法詳細モーダル
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);

  const isMyAdvisorView =
    !!advisorKey && !!selectedAdvisor && advisorKey === selectedAdvisor;

  // 相談者一覧を取得（user_officers に登場した user_key）
  useEffect(() => {
    if (!ready) return;
    if (!advisorKey) {
      setLoading(false);
      return;
    }

    const fetchOwners = async () => {
      setLoading(true);

      const { data: ownerRows, error } = await supabase
        .from("user_officers")
        .select("user_key")
        .not("user_key", "is", null);

      if (error) {
        alert("相談者一覧取得エラー: " + error.message);
        setLoading(false);
        return;
      }

      const owners = Array.from(
        new Set((ownerRows || []).map((r: any) => r.user_key as string))
      ).sort((a, b) => a.localeCompare(b, "ja"));

      setOwnerList(owners);

      // URLパラメータ owner に応じて初期の相談者を決定
      const ownerParam = searchParams.get("owner"); // "me" or specific name

      let initialOwner = ownerKey;

      if (!initialOwner && owners.length > 0) {
        if (ownerParam === "me" && advisorKey && owners.includes(advisorKey)) {
          // /formation?owner=me かつ ログインユーザーが相談者一覧に含まれる → 自分宛
          initialOwner = advisorKey;
        } else if (ownerParam && owners.includes(ownerParam)) {
          // /formation?owner=xxx で、xxx が相談者一覧に含まれる
          initialOwner = ownerParam;
        } else if (advisorKey && owners.includes(advisorKey)) {
          // パラメータはないが、ログインユーザーも相談者として登録されている
          initialOwner = advisorKey;
        } else {
          // それ以外は先頭をデフォルトに
          initialOwner = owners[0];
        }
      }

      if (initialOwner) {
        setOwnerKey(initialOwner);
      }

      setLoading(false);
    };

    fetchOwners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, advisorKey]);

  // ownerKey が決まったら、その相談者のマスタ & 編成一覧を取得
  useEffect(() => {
    if (!ready) return;
    if (!advisorKey) return;
    if (!ownerKey) return;

    const fetchOwnerData = async () => {
      setLoading(true);

      // 1. 相談者の所持武将
      const { data: userOfficers, error: uoError } = await supabase
        .from("user_officers")
        .select("officer_id")
        .eq("user_key", ownerKey)
        .gt("count", 0);

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

      // 2. 相談者の所持戦法（カードとして）
      const { data: userSkills, error: usError } = await supabase
        .from("user_skills")
        .select("skill_id, count")
        .eq("user_id", ownerKey)
        .gt("count", 0);

      if (usError) {
        alert("user_skills取得エラー: " + usError.message);
        setLoading(false);
        return;
      }

      const ownedSkillIds = new Set(
        (userSkills || []).map((s) => s.skill_id as number)
      );

      // 3. skills 全体（固有のみも含む）
      const { data: skillsData, error: sError } = await supabase
        .from("skills")
        .select(
          "id, name, category, description, inherit1_name, inherit2_name, trigger_rate"
        )
        .order("name", { ascending: true });

      if (sError) {
        alert("skills取得エラー: " + sError.message);
        setLoading(false);
        return;
      }

      const allSkills: Skill[] = (skillsData || []).map((row: any) => {
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
      });

      setSkills(allSkills);

      // 4. この相談者の編成一覧（owner_key 単位）
      const { data: formationRows, error: formError } = await supabase
        .from("formations")
        .select("label, advisor_key")
        .eq("owner_key", ownerKey);

      if (formError) {
        alert("formations一覧取得エラー: " + formError.message);
        setLoading(false);
        return;
      }

      const map: Record<string, string[]> = {};

      (formationRows || []).forEach((r: any) => {
        const adv = r.advisor_key as string | null;
        if (!adv) return;
        if (!map[adv]) map[adv] = [];
        map[adv].push(r.label as string);
      });

      Object.keys(map).forEach((adv) => {
        const labels = Array.from(new Set(map[adv]));
        labels.sort((a, b) => {
          const na = parseInt(a.replace("編成", ""), 10);
          const nb = parseInt(b.replace("編成", ""), 10);
          if (Number.isNaN(na) || Number.isNaN(nb)) {
            return a.localeCompare(b, "ja");
          }
          return na - nb;
        });
        map[adv] = labels;
      });

      const advisors = Array.from(
        new Set([...Object.keys(map), advisorKey])
      ).sort((a, b) => a.localeCompare(b, "ja"));

      setLabelMap(map);
      setAdvisorList(advisors);

      const initialAdvisor = advisors.includes(selectedAdvisor)
        ? selectedAdvisor
        : advisorKey ?? "";

      setSelectedAdvisor(initialAdvisor);

      const labelsForInitial =
        (map[initialAdvisor] && map[initialAdvisor].length > 0
          ? map[initialAdvisor]
          : ["編成1"]);

      setKnownLabels(labelsForInitial);
      setLoading(false);

      if (labelsForInitial.length > 0) {
        await loadFormation(ownerKey, initialAdvisor, labelsForInitial[0]);
      }
    };

    fetchOwnerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, advisorKey, ownerKey]);

  const loadFormation = async (
    ownerKeyParam: string,
    advisorKeyParam: string,
    label: string
  ) => {
    if (!ownerKeyParam || !advisorKeyParam) return;

    setFormationLoading(true);
    setCurrentLabel(label);
    setFormationId(null);
    setSlots(EMPTY_SLOTS);
    setRequestcomment("");
    setAnswercomment("");

    const { data: formation, error: fError } = await supabase
      .from("formations")
      .select("id, label, request_comment, answer_comment")
      .eq("owner_key", ownerKeyParam)
      .eq("advisor_key", advisorKeyParam)
      .eq("label", label)
      .maybeSingle();

    if (fError) {
      alert("formations取得エラー: " + fError.message);
      setFormationLoading(false);
      return;
    }

    if (formation) {
      setFormationId(formation.id);
      setRequestcomment(formation.request_comment ?? "");
      setAnswercomment(formation.answer_comment ?? "");

      const { data: slotRows, error: fsError } = await supabase
        .from("formation_slots")
        .select("position, officer_id, inherit_skill1_id, inherit_skill2_id")
        .eq("formation_id", formation.id);

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

      (slotRows || []).forEach((row: any) => {
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

  const handleAddFormation = () => {
    if (!ownerKey) {
      alert("先に相談者を選択してください");
      return;
    }
    if (!advisorKey) {
      alert("ログイン情報が取得できません");
      return;
    }
    if (!isMyAdvisorView) {
      alert("編成を追加できるのは自分の編成者タブのみです。");
      return;
    }

    const myLabels = labelMap[advisorKey] ?? [];
    if (myLabels.length >= MAX_FORMATIONS) {
      alert(`編成は最大 ${MAX_FORMATIONS} 個までです。`);
      return;
    }

    const usedIndices = myLabels
      .map((lbl) => parseInt(lbl.replace("編成", ""), 10))
      .filter((n) => !Number.isNaN(n));

    let nextIndex = 1;
    while (usedIndices.includes(nextIndex)) {
      nextIndex += 1;
    }

    const newLabel = `編成${nextIndex}`;
    const newMyLabels = [...myLabels, newLabel];

    setLabelMap((prev) => ({
      ...prev,
      [advisorKey]: newMyLabels,
    }));
    setKnownLabels(newMyLabels);
    setSelectedAdvisor(advisorKey);

    loadFormation(ownerKey, advisorKey, newLabel);
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
    if (!advisorKey) {
      alert("ログイン情報が取得できません");
      return;
    }
    if (!ownerKey) {
      alert("先に相談者を選択してください");
      return;
    }
    if (!isMyAdvisorView) {
      alert("保存できるのは自分の編成者タブのみです。");
      return;
    }

    setSaving(true);

    const formationRow = {
      id: formationId ?? undefined,
      owner_key: ownerKey,
      advisor_key: advisorKey,
      user_key: ownerKey, // 互換用：従来の user_key も相談者で埋める
      label: currentLabel,
      request_comment: requestcomment,
      answer_comment: answercomment,
    };

    const { data: upserted, error: upError } = await supabase
      .from("formations")
      .upsert(formationRow)
      .select("id")
      .single();

    if (upError) {
      alert("formations保存エラー: " + upError.message);
      setSaving(false);
      return;
    }

    const currentFormationId = upserted?.id as number | undefined;
    setFormationId(currentFormationId ?? null);

    if (!currentFormationId) {
      alert("formationsのID取得に失敗しました");
      setSaving(false);
      return;
    }

    const { error: delError } = await supabase
      .from("formation_slots")
      .delete()
      .eq("formation_id", currentFormationId);

    if (delError) {
      alert("古いスロット削除エラー: " + delError.message);
      setSaving(false);
      return;
    }

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

    setLabelMap((prev) => {
      const myLabels = new Set(prev[advisorKey] ?? []);
      myLabels.add(currentLabel);
      const newMyLabels = Array.from(myLabels).sort((a, b) => {
        const na = parseInt(a.replace("編成", ""), 10);
        const nb = parseInt(b.replace("編成", ""), 10);
        if (Number.isNaN(na) || Number.isNaN(nb)) {
          return a.localeCompare(b, "ja");
        }
        return na - nb;
      });
      setKnownLabels(newMyLabels);
      return {
        ...prev,
        [advisorKey]: newMyLabels,
      };
    });
  };

  const handleCopyFormation = async () => {
    if (!ownerKey) {
      alert("先に相談者を選択してください");
      return;
    }

    const advisorLabel = selectedAdvisor || advisorKey || "";

    const text = formatFormationForCopy({
      ownerKey,
      advisorLabel,
      label: currentLabel,
      slots,
      officers,
      skills,
      requestcomment,
      answercomment,
    });

    const ok = await copyToClipboard(text);
    if (ok) {
      alert("編成内容をクリップボードにコピーしました");
    } else {
      alert("コピーに失敗しました");
    }
  };

  if (!ready) {
    return <div className="p-4">ユーザー情報を読み込み中...</div>;
  }

  if (!advisorKey) {
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

  // セレクトに出す戦法：伝授可能かつ「所持 or 伝授者あり」のみ
  const selectableSkills = skills.filter((s) => {
    const hasInherit = !!(s.inherit1_name || s.inherit2_name);
    const usable = s.isOwned || s.isInheritable;
    return hasInherit && usable;
  });

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">編成作成</h1>

      <div className="text-sm text-gray-600 mb-1">
        編成者(ログイン中): <strong>{advisorKey}</strong>{" "}
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

      {/* 共通メニュー */}
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

      {/* 相談者 & 編成者タブ */}
      <div className="flex flex-col gap-2 text-sm mb-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span>相談者:</span>
            <select
              className="border rounded px-2 py-1"
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
            >
              {ownerList.length === 0 && (
                <option value="">(相談者なし)</option>
              )}
              {ownerList.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {ownerKey && (
            <div className="flex items-center gap-2">
              <span>編成者:</span>
              <div className="flex flex-wrap gap-1">
                {advisorList.map((adv) => (
                  <button
                    key={adv}
                    type="button"
                    className={`px-3 py-1 rounded border text-xs ${
                      selectedAdvisor === adv
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-700 border-gray-300"
                    }`}
                    onClick={() => {
                      setSelectedAdvisor(adv);
                      const labels =
                        labelMap[adv] && labelMap[adv].length > 0
                          ? labelMap[adv]
                          : ["編成1"];
                      setKnownLabels(labels);
                      if (labels.length > 0) {
                        loadFormation(ownerKey, adv, labels[0]);
                      }
                    }}
                  >
                    {adv === advisorKey ? `${adv}（自分）` : adv}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {ownerKey && (
          <p className="text-xs text-gray-600">
            現在{" "}
            <span className="font-semibold">{ownerKey}</span>
            さん宛の編成を表示しています。上の「編成者」から、誰が作成した編成を見るかを選べます。
          </p>
        )}
      </div>

      {/* 編成タブ */}
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
            onClick={() =>
              ownerKey &&
              selectedAdvisor &&
              loadFormation(ownerKey, selectedAdvisor, label)
            }
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="px-3 py-1 rounded border text-sm bg-white text-blue-600 border-blue-400"
          onClick={handleAddFormation}
          title="編成を追加"
          disabled={!ownerKey || !isMyAdvisorView}
        >
          ＋
        </button>
      </div>

      {ownerKey && !isMyAdvisorView && (
        <p className="text-xs text-red-500">
          ※ 他の編成者の編成を閲覧中です。保存・追加は自分の編成者タブのみ可能です。
        </p>
      )}

      {formationLoading && (
        <div className="text-sm text-gray-500">編成読み込み中...</div>
      )}

      {/* コメント */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold mb-1">
            依頼者コメント
          </label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm"
            rows={3}
            placeholder="例: 信長を軸にお願いします！"
            value={requestcomment}
            onChange={(e) => setRequestcomment(e.target.value)}
            disabled={!isMyAdvisorView}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">
            回答者コメント
          </label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm"
            rows={3}
            placeholder="例: 武田家中心に組んでみました。"
            value={answercomment}
            onChange={(e) => setAnswercomment(e.target.value)}
            disabled={!isMyAdvisorView}
          />
        </div>
      </div>

      <p className="text-sm text-gray-600">
        ・相談者が所持している武将だけが選択肢に出ます。
        <br />
        ・伝授戦法は、「相談者が所持している戦法」＋「相談者が伝授武将を所持している戦法」が選べます。
        （固有のみの戦法も「固有戦法」の詳細ボタンから内容を確認できます）
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !ownerKey || !isMyAdvisorView}
          className={`px-4 py-2 rounded ${
            saving || !ownerKey || !isMyAdvisorView
              ? "bg-gray-300 text-gray-600"
              : "bg-blue-500 text-white"
          }`}
        >
          {saving ? "保存中..." : `${currentLabel} を保存`}
        </button>

        <button
          type="button"
          onClick={handleCopyFormation}
          disabled={!ownerKey}
          className={`px-3 py-2 rounded border text-sm ${
            !ownerKey
              ? "bg-gray-300 text-gray-600 border-gray-300"
              : "bg-white text-gray-700 border-gray-400 hover:bg-gray-50"
          }`}
        >
          編成内容をコピー
        </button>
      </div>

      {/* 編成スロット */}
      <div className="grid gap-4 md:grid-cols-3 mt-4">
        {POSITIONS.map(({ key, label }) => {
          const slot = slots[key];
          const officer = officers.find((o) => o.id === slot.officerId);
          const inheritSkill1 = skills.find((s) => s.id === slot.inherit1Id);
          const inheritSkill2 = skills.find((s) => s.id === slot.inherit2Id);

          const inherentSkill =
            officer?.inherent_skill_name
              ? skills.find((s) => s.name === officer.inherent_skill_name)
              : undefined;

          const renderSkillLabel = (s: Skill) => {
            const flags = [
              s.isOwned ? "所持" : null,
              s.isInheritable ? "伝授可" : null,
            ]
              .filter(Boolean)
              .join("/");

            return `${s.name}（${s.category ?? "種類不明"}・${
              flags || "対象外"
            }）`;
          };

          return (
            <div
              key={key}
              className={`border rounded p-3 space-y-2 bg-white ${
                !isMyAdvisorView ? "opacity-70" : ""
              }`}
            >
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
                  disabled={!isMyAdvisorView}
                >
                  <option value="">-- 未選択 --</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}（★{o.rarity} / {o.faction}）
                    </option>
                  ))}
                </select>
              </div>

              {/* 固有戦法（詳細ボタン付き） */}
              <div className="text-sm flex items-center justify-between">
                <div>
                  <span className="font-semibold">固有戦法: </span>
                  {officer?.inherent_skill_name || "-"}
                </div>
                {inherentSkill && (
                  <button
                    type="button"
                    className="ml-2 text-xs px-2 py-1 border rounded bg-white hover:bg-blue-50"
                    onClick={() => setDetailSkill(inherentSkill)}
                  >
                    詳細
                  </button>
                )}
              </div>

              {/* 伝授戦法1 */}
              <div>
                <label className="text-sm block mb-1">伝授戦法1</label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={slot.inherit1Id ?? ""}
                  onChange={(e) =>
                    handleChangeSkill(key, 1, e.target.value)
                  }
                  disabled={!isMyAdvisorView}
                >
                  <option value="">-- なし --</option>
                  {selectableSkills.map((s) => (
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

              {/* 伝授戦法2 */}
              <div>
                <label className="text-sm block mb-1">伝授戦法2</label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={slot.inherit2Id ?? ""}
                  onChange={(e) =>
                    handleChangeSkill(key, 2, e.target.value)
                  }
                  disabled={!isMyAdvisorView}
                >
                  <option value="">-- なし --</option>
                  {selectableSkills.map((s) => (
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
          className="fixed inset-0 z-50 flex items-center justify.center bg-black/40"
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
                  detailSkill.isInheritable ? "伝授可" : null,
                ]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </div>
            </div>

            <div className="text-sm space-y-2 mb-3">
              <div>
                <span className="font-semibold">伝授者1:</span>{" "}
                {detailSkill.inherit1_name ?? "-"}
              </div>
              <div>
                <span className="font-semibold">伝授者2:</span>{" "}
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

export default function FormationPage() {
  return (
    <Suspense fallback={<div className="p-4">URL 情報を読み込み中...</div>}>
      <FormationPageInner />
    </Suspense>
  );
}
