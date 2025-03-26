import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';

interface ExerciseData {
  sets: { weight: number; reps: number }[];
  name: string;
}

export default function TrainingApp() {
  const [complexes, setComplexes] = useState<any>({});
  const [names, setNames] = useState<any>({});
  const [selectedComplex, setSelectedComplex] = useState<any>(null);
  const [currentExercise, setCurrentExercise] = useState<number>(0);
  const [results, setResults] = useState<any>({});
  const [restTime, setRestTime] = useState<number | null>(null);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [history, setHistory] = useState<any[]>(() => {
    const stored = localStorage.getItem("training_history");
    return stored ? JSON.parse(stored) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | null>(null);
  const [trainingRating, setTrainingRating] = useState<number>(5);
  const [conditionRating, setConditionRating] = useState<number>(5);
  const [trainingComment, setTrainingComment] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'training' | 'history'>('training');
  const [isTrainingFinished, setIsTrainingFinished] = useState<boolean>(false);
  const [editingSet, setEditingSet] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);

  const current = selectedComplex ? selectedComplex[currentExercise] : null;

  useEffect(() => {
    localStorage.setItem("training_results", JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    localStorage.setItem("training_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    fetch('/training_history.json')
      .then(response => response.json())
      .then(data => {
        setHistory(data);
      })
      .catch(error => console.error('Ошибка загрузки истории:', error));
  }, []);

  useEffect(() => {
    const loadJSONData = async () => {
      try {
      const response = await fetch('/training_program.json');
        if (!response.ok) throw new Error('Файл не найден');

        const json = await response.json();
        const grouped: any = {};
        const names: any = {};

        json.forEach((entry: any) => {
          grouped[entry.id] = entry.exercises;
          names[entry.id] = entry.complex;
        });

        console.log("Grouped complexes", grouped);
        console.log("Names", names);
        setComplexes(grouped);
        setNames(names);
        setSelectedComplex(grouped[Object.keys(grouped)[0]]);
      } catch (error: any) {
        setError(error.message);
      }
    };

    loadJSONData();
  }, []);

  const deleteSet = (exerciseIndex: number, setIndex: number) => {
    const key = `${exerciseIndex}`;
    const prev = results[key] || { sets: [], comment: "" };
    const updated = {
      ...results,
      [key]: {
        ...prev,
        sets: prev.sets.filter((_: any, i: number) => i !== setIndex)
      }
    };
    setResults(updated);
  };

  const editSet = (exerciseIndex: number, setIndex: number) => {
    setEditingSet({ exerciseIndex, setIndex });
  };

  const saveSet = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const weight = formData.get('weight');
    const reps = formData.get('reps');

    if (!weight || !reps) {
      setError('Пожалуйста, введите вес и количество повторений');
      return;
    }

    const key = `${currentExercise}`;
    const prev = results[key] || { sets: [], comment: "" };

    let updated;
    if (editingSet && editingSet.exerciseIndex === currentExercise) {
      // Редактирование существующего подхода
      const newSets = [...prev.sets];
      newSets[editingSet.setIndex] = {
        weight: Number(weight),
        reps: Number(reps)
      };
      updated = {
        ...results,
        [key]: { ...prev, sets: newSets }
      };
    } else {
      // Добавление нового подхода
      updated = {
        ...results,
        [key]: {
          ...prev,
          sets: [...prev.sets, {
            weight: Number(weight),
            reps: Number(reps)
          }]
        }
      };
    }

    setResults(updated);
    e.target.reset();
    setEditingSet(null);
    setRestTime(60);

    if (intervalId) {
      clearInterval(intervalId);
    }

    const id = setInterval(() => {
      setRestTime((prev) => {
        if (prev === 1) {
          clearInterval(id);
          return null;
        }
        return (prev ?? 1) - 1;
      });
    }, 1000);

    setIntervalId(id);
    setError(null);
  };

  const totalSets = selectedComplex?.reduce(
    (sum: number, ex: any, idx: number) => sum + (results[idx]?.sets?.length || 0),
    0
  ) || 0;

  const expectedSets = selectedComplex?.reduce((sum: number, ex: any) => sum + (ex.sets || 0), 0) || 1;

  const progress = Math.min((totalSets / expectedSets) * 100, 100);

  const finishTraining = () => {
    if (!selectedComplex) return;
    setIsTrainingFinished(true);
  };

  const saveTrainingSummary = async () => {
    const complexKey = Object.keys(complexes).find(key => complexes[key] === selectedComplex);
    const selectedComplexName = complexKey ? names[complexKey] : 'Комплекс не найден';

    const namedResults: Record<string, any> = {};
    selectedComplex.forEach((exercise: any, idx: number) => {
      if (results[idx]) {
        namedResults[`${exercise.name}`] = {
          sets: results[idx].sets.map((set: any) => ({
            weight: set.weight,
            reps: set.reps
          })),
          name: exercise.name
        };
      }
    });

    const summary = {
      date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }),
      complex: selectedComplexName,
      results: namedResults,
      trainingRating,
      conditionRating,
      trainingComment
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/save-training`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trainingData: summary }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[SAVE] Ошибка:", errorData);
      }

      if (response.ok) {
        setSaveStatus('success');
        console.log("[SAVE] Тренировка успешно сохранена");
      } else {
        setSaveStatus('error');
        console.warn("[SAVE] Сервер вернул ошибку при сохранении");
      }
    } catch (error) {
      console.error('[SAVE] Ошибка при сохранении тренировки:', error);
      setSaveStatus('error');
    }

    setHistory(prev => [...prev, summary]);
    setResults({});
    setSelectedComplex(null);
    setCurrentExercise(0);
    setTrainingRating(5);
    setConditionRating(5);
    setTrainingComment("");
    setIsTrainingFinished(false);
  };

  useEffect(() => {
    if (saveStatus) {
      const timeout = setTimeout(() => setSaveStatus(null), 4000);
      return () => clearTimeout(timeout);
    }
  }, [saveStatus]);

  console.log("Текущие данные упражнения:", current);

  return (
    <div className="max-w-xs mx-auto p-4">
      <div className="space-y-6">
        <div className="flex justify-center space-x-4">
          <button onClick={() => setActiveTab('training')} className={`px-4 py-2 ${activeTab === 'training' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Тренировка</button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>История</button>
        </div>

        {activeTab === 'training' && !isTrainingFinished && (
          <>
            {saveStatus && (
              <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded text-white transition-all ${
                saveStatus === "success" ? "bg-green-600" : "bg-red-600"
              }`}>
                {saveStatus === "success" ? "Тренировка успешно сохранена!" : "Ошибка при сохранении тренировки."}
              </div>
            )}
            <h1 className="text-2xl font-bold text-white text-center">🏋️ Тренировка</h1>

            {error && <div className="text-red-500">{error}</div>}

            <select
              className="border rounded p-2 bg-gray-700 text-white w-full"
              onChange={(e) => setSelectedComplex(complexes[e.target.value])}
            >
              <option value="">Выбери комплекс</option>
              {Object.keys(complexes).map((id) => (
                <option key={id} value={id}>{names[id] || `Комплекс ${id}`}</option>
              ))}
            </select>

            {current && (
              <div className="space-y-4">
                <div className="w-full bg-gray-700 h-2 rounded">
                  <div
                    className="bg-blue-600 h-2 rounded"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                <div className="flex gap-2 overflow-x-auto">
                  {selectedComplex.map((_: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setCurrentExercise(i)}
                      className={`flex-1 px-3 py-1 rounded text-sm ${i === currentExercise ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <h2 className="text-xl font-semibold text-white">{current.name}</h2>
                <div className="text-sm text-gray-400">{current.sets} × {current.reps} — {current.type}</div>
                <div className="text-sm text-gray-400">Рекомендуемый вес: {current.weight} кг</div>

                <details className="bg-gray-800 border border-gray-700 p-3 rounded mt-1">
                  <summary className="cursor-pointer font-medium text-white">Описание упражнения</summary>
                  <div className="prose mt-2 text-gray-300">
                    <ReactMarkdown>{current.description}</ReactMarkdown>
                    <ReactMarkdown>{current.tips}</ReactMarkdown>
                  </div>
                </details>

                {results[currentExercise]?.sets?.length > 0 && (
                  <ul className="list-disc pl-0 text-sm text-gray-300 w-full">
                    {results[currentExercise].sets.map((s: any, i: number) => (
                      <li key={i} className="flex flex-col items-start justify-between py-1 bg-gray-800 rounded-md my-2 w-full p-5" style={{ margin: '20px 0' }}>
                        <span>Подход {i + 1}: {s.weight} кг × {s.reps} раз</span>
                        <div className="flex justify-between w-full mt-2">
                          <button
                            onClick={() => editSet(currentExercise, i)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Редактировать
                          </button>
                          <button
                            onClick={() => deleteSet(currentExercise, i)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Удалить
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={saveSet} className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <input
                      name="weight"
                      type="number"
                      placeholder="Вес"
                      className="border p-2 rounded bg-gray-700 text-white"
                      required
                      defaultValue={editingSet && editingSet.exerciseIndex === currentExercise
                        ? results[currentExercise]?.sets[editingSet.setIndex]?.weight
                        : ''}
                    />
                    <input
                      name="reps"
                      type="number"
                      placeholder="Повторы"
                      className="border p-2 rounded bg-gray-700 text-white"
                      required
                      defaultValue={editingSet && editingSet.exerciseIndex === currentExercise
                        ? results[currentExercise]?.sets[editingSet.setIndex]?.reps
                        : ''}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    {editingSet && editingSet.exerciseIndex === currentExercise ? 'Сохранить изменения' : 'Сохранить подход'}
                  </button>
                  {editingSet && editingSet.exerciseIndex === currentExercise && (
                    <button
                      type="button"
                      onClick={() => setEditingSet(null)}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
                    >
                      Отменить
                    </button>
                  )}
                </form>

                {restTime !== null && (
                  <p className="text-green-400">Отдых: {restTime} сек</p>
                )}

                <textarea
                  placeholder="Комментарий к упражнению"
                  className="w-full border rounded p-2 bg-gray-700 text-white"
                  value={results[currentExercise]?.comment || ''}
                  onChange={(e) => {
                    const key = `${currentExercise}`;
                    const prev = results[key] || { sets: [], comment: "" };
                    setResults({
                      ...results,
                      [key]: { ...prev, comment: e.target.value }
                    });
                  }}
                />

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setCurrentExercise(Math.max(0, currentExercise - 1))}
                    className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                  >← Назад</button>
                  <button
                    onClick={() => {
                      if (currentExercise + 1 < selectedComplex.length) {
                        setCurrentExercise(currentExercise + 1);
                      } else {
                        finishTraining();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >{currentExercise + 1 === selectedComplex.length ? 'Завершить' : 'Далее →'}</button>
                </div>
              </div>
            )}
          </>
        )}

        {isTrainingFinished && (
          <div className="space-y-4 w-full">
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300">Оценка тренировки</label>
              <input
                type="range"
                min="1"
                max="10"
                value={trainingRating}
                onChange={(e) => setTrainingRating(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-gray-300">{trainingRating}</span>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300">Оценка состояния</label>
              <input
                type="range"
                min="1"
                max="10"
                value={conditionRating}
                onChange={(e) => setConditionRating(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-gray-300">{conditionRating}</span>
            </div>

            <textarea
              placeholder="Комментарий к тренировке"
              className="w-full border rounded p-2 mt-4 bg-gray-700 text-white"
              value={trainingComment}
              onChange={(e) => setTrainingComment(e.target.value)}
            />

            <button onClick={saveTrainingSummary} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Сохранить</button>
          </div>
        )}

        {activeTab === 'history' && history.length > 0 && (
          <div className="mt-8 w-full">
            <h3 className="font-bold text-lg mb-2 text-white">История тренировок</h3>
            <ul className="space-y-2 text-sm">
              {history.slice().reverse().map((h: any, i: number) => (
                <li key={i} className="border border-gray-700 rounded p-2 bg-gray-800 w-full">
                  <div className="font-semibold text-white">{h.complex}</div>
                  <div className="text-gray-400">{h.date}</div>
                  <div className="text-gray-400">Оценка тренировки: {h.trainingRating}</div>
                  <div className="text-gray-400">Оценка состояния: {h.conditionRating}</div>
                  <div className="text-gray-400">Комментарий: {h.trainingComment}</div>
                  <div className="mt-2">
                    <h4 className="font-semibold text-gray-300">Подходы:</h4>
                    {Object.entries(h.results).map(([exerciseName, exerciseData]: [string, ExerciseData]) => (
                      <div key={exerciseName} className="mt-2">
                        <div className="text-gray-300">{exerciseData.name}</div>
                        <ul className="list-disc pl-4">
                          {exerciseData.sets.map((set: any, index: number) => (
                            <li key={index} className="text-gray-300">
                              {index + 1} подход: {set.weight} кг × {set.reps} раз
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
