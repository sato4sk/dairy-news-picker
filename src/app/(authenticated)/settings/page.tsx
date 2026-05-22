'use client';

import { useState, useEffect } from 'react';
import { getFeedGroups, saveFeedGroup, deleteFeedGroup, updateFeedGroupsOrder } from '@/lib/db-actions';
import { FeedGroup } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Settings, Plus, Trash2, Save, X, Loader2, Globe, Edit2, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FeedGroup | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newFeed, setNewFeed] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);
    try {
      const data = await getFeedGroups();
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
      toast.error('グループの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (group: FeedGroup) => {
    setEditingId(group.id);
    setEditForm({ ...group });
    setNewKeyword('');
    setNewFeed('');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
    loadGroups(); // Refresh to remove any unsaved local additions
  };

  const handleSave = async () => {
    if (!editForm) return;
    try {
      await saveFeedGroup(editForm);
      toast.success('設定を保存しました');
      setEditingId(null);
      setEditForm(null);
      loadGroups();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('設定の保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このグループを削除してもよろしいですか？')) return;
    try {
      await deleteFeedGroup(id);
      toast.success('グループを削除しました');
      const updatedGroups = groups.filter(g => g.id !== id);
      // Re-index remaining groups to maintain order consistency
      const reorderedGroups = updatedGroups.map((g, index) => ({ ...g, order: index }));
      await updateFeedGroupsOrder(reorderedGroups.map(g => ({ id: g.id, order: g.order })));
      loadGroups();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('グループの削除に失敗しました');
    }
  };

  const handleAddGroup = () => {
    const newId = `group_${Date.now()}`;
    const newGroup: FeedGroup = {
      id: newId,
      name: '新しいグループ',
      keywords: [],
      feeds: [],
      order: groups.length,
    };
    setGroups(prev => [...prev, newGroup]);
    setEditingId(newId);
    setEditForm(newGroup);
    setNewKeyword('');
    setNewFeed('');
  };

  const handleMoveGroup = async (index: number, direction: 'up' | 'down') => {
    const newGroups = [...groups];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newGroups.length) return;

    // Swap
    const temp = newGroups[index];
    newGroups[index] = newGroups[targetIndex];
    newGroups[targetIndex] = temp;

    // Update order values
    const updatedGroups = newGroups.map((group, idx) => ({
      ...group,
      order: idx
    }));

    setGroups(updatedGroups);

    try {
      await updateFeedGroupsOrder(updatedGroups.map(g => ({ id: g.id, order: g.order })));
      toast.success('順序を更新しました');
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('順序の更新に失敗しました');
      loadGroups(); // Revert on failure
    }
  };

  // Keyword Helpers
  const addKeyword = () => {
    if (!editForm || !newKeyword.trim()) return;
    if (editForm.keywords.includes(newKeyword.trim())) {
      setNewKeyword('');
      return;
    }
    setEditForm({
      ...editForm,
      keywords: [...editForm.keywords, newKeyword.trim()]
    });
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      keywords: editForm.keywords.filter(k => k !== kw)
    });
  };

  // Feed Helpers
  const addFeed = () => {
    if (!editForm || !newFeed.trim()) return;
    if (editForm.feeds.includes(newFeed.trim())) {
      setNewFeed('');
      return;
    }
    setEditForm({
      ...editForm,
      feeds: [...editForm.feeds, newFeed.trim()]
    });
    setNewFeed('');
  };

  const removeFeed = (url: string) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      feeds: editForm.feeds.filter(f => f !== url)
    });
  };

  if (loading && groups.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
          <p className="text-slate-500 text-sm font-medium">フィードグループとキーワードを管理します。</p>
        </div>
        <Button onClick={handleAddGroup} className="bg-slate-900 hover:bg-slate-800 font-bold h-9 rounded-full px-4 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          グループ追加
        </Button>
      </header>

      <div className="grid gap-4">
        {groups.map((group) => (
          <Card key={group.id} className={editingId === group.id ? 'ring-2 ring-blue-500 shadow-lg py-0 gap-0' : 'py-0 gap-0'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 border-b bg-slate-50/50">
              <div className="flex-1 pr-4">
                {editingId === group.id ? (
                  <Input
                    value={editForm?.name}
                    onChange={(e) => setEditForm(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    className="text-base font-bold h-9 bg-white"
                    placeholder="グループ名"
                  />
                ) : (
                  <CardTitle className="text-lg font-bold tracking-tight text-slate-900">{group.name}</CardTitle>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {editingId === group.id ? (
                  <>
                    <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleSave} className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-0.5 mr-1 border-r pr-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        onClick={() => handleMoveGroup(groups.indexOf(group), 'up')}
                        disabled={groups.indexOf(group) === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        onClick={() => handleMoveGroup(groups.indexOf(group), 'down')}
                        disabled={groups.indexOf(group) === groups.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(group)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(group.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-3 pb-5 space-y-6">
              {/* Keywords Section */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Keywords</label>
                <div className="flex flex-wrap gap-1.5">
                  {(editingId === group.id ? editForm?.keywords : group.keywords)?.map((kw) => (
                    <span key={kw} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 tracking-tight">
                      {kw}
                      {editingId === group.id && (
                        <button
                          type="button"
                          onClick={() => removeKeyword(kw)}
                          className="ml-1 inline-flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                  {(editingId === group.id && editForm?.keywords.length === 0) && (
                    <span className="text-xs text-slate-400 italic">No keywords added</span>
                  )}
                  {!(editingId === group.id) && group.keywords.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No keywords</span>
                  )}
                </div>
                {editingId === group.id && (
                  <div className="flex gap-1.5 max-w-sm pt-1">
                    <Input
                      placeholder="Add keyword..."
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          addKeyword();
                        }
                      }}
                      className="text-sm h-8"
                    />
                    <Button variant="secondary" onClick={addKeyword} className="font-bold h-8 text-[10px] px-3">ADD</Button>
                  </div>
                )}
              </div>

              {/* RSS Feeds Section */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">RSS Feeds</label>
                <div className="space-y-1.5">
                  {(editingId === group.id ? editForm?.feeds : group.feeds)?.map((url) => (
                    <div key={url} className="flex items-center justify-between group rounded-lg border bg-slate-50/50 p-2 pr-1 transition-colors hover:bg-white">
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <Globe className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <span className="truncate text-xs text-slate-600 font-medium">{url}</span>
                      </div>
                      {editingId === group.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600"
                          onClick={() => removeFeed(url)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {(editingId === group.id ? editForm?.feeds.length === 0 : group.feeds.length === 0) && (
                    <div className="rounded-lg border border-dashed p-3 text-center text-xs text-slate-400 uppercase tracking-tighter">
                      No RSS feeds added
                    </div>
                  )}
                </div>
                {editingId === group.id && (
                  <div className="flex gap-1.5 pt-1">
                    <Input
                      placeholder="https://example.com/rss.xml"
                      value={newFeed}
                      onChange={(e) => setNewFeed(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          addFeed();
                        }
                      }}
                      className="text-sm h-8"
                    />
                    <Button variant="secondary" onClick={addFeed} className="font-bold h-8 text-[10px] px-3">ADD FEED</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
