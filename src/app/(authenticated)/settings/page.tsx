'use client';

import { useState, useEffect } from 'react';
import { getFeedGroups, saveFeedGroup, deleteFeedGroup } from '@/lib/db-actions';
import { FeedGroup } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Settings, Plus, Trash2, Save, X, Loader2, Globe } from 'lucide-react';
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
      toast.error('Failed to load feed groups');
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
      toast.success('Settings saved');
      setEditingId(null);
      setEditForm(null);
      loadGroups();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
      await deleteFeedGroup(id);
      toast.success('Group deleted');
      loadGroups();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete group');
    }
  };

  const handleAddGroup = () => {
    const newId = `group_${Date.now()}`;
    const newGroup: FeedGroup = {
      id: newId,
      name: 'New Group',
      keywords: [],
      feeds: [],
    };
    setGroups(prev => [newGroup, ...prev]);
    setEditingId(newId);
    setEditForm(newGroup);
    setNewKeyword('');
    setNewFeed('');
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
    <div className="container max-w-4xl space-y-8 pb-20 pt-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="h-8 w-8 text-slate-700" />
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <Button onClick={handleAddGroup}>
          <Plus className="mr-2 h-4 w-4" />
          Add Group
        </Button>
      </header>

      <div className="grid gap-6">
        {groups.map((group) => (
          <Card key={group.id} className={editingId === group.id ? 'ring-2 ring-blue-500 shadow-lg' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1 flex-1 pr-4">
                {editingId === group.id ? (
                  <Input
                    value={editForm?.name}
                    onChange={(e) => setEditForm(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    className="text-xl font-bold h-10"
                    placeholder="Group Name"
                  />
                ) : (
                  <CardTitle className="text-xl">{group.name}</CardTitle>
                )}
                <CardDescription className="font-mono text-xs">{group.id}</CardDescription>
              </div>
              <div className="flex space-x-2">
                {editingId === group.id ? (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(group)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600" onClick={() => handleDelete(group.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Keywords Section */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900 uppercase tracking-wider">Keywords</label>
                <div className="flex flex-wrap gap-2">
                  {(editingId === group.id ? editForm?.keywords : group.keywords)?.map((kw) => (
                    <span key={kw} className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {kw}
                      {editingId === group.id && (
                        <button
                          type="button"
                          onClick={() => removeKeyword(kw)}
                          className="ml-1.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {(editingId === group.id && editForm?.keywords.length === 0) && (
                    <span className="text-sm text-slate-400 italic">No keywords added</span>
                  )}
                  {!(editingId === group.id) && group.keywords.length === 0 && (
                    <span className="text-sm text-slate-400 italic">No keywords</span>
                  )}
                </div>
                {editingId === group.id && (
                  <div className="flex gap-2 max-w-sm">
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
                    />
                    <Button variant="secondary" onClick={addKeyword}>Add</Button>
                  </div>
                )}
              </div>

              {/* RSS Feeds Section */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900 uppercase tracking-wider">RSS Feeds</label>
                <div className="space-y-2">
                  {(editingId === group.id ? editForm?.feeds : group.feeds)?.map((url) => (
                    <div key={url} className="flex items-center justify-between group rounded-lg border bg-slate-50 p-2 pr-1 transition-colors hover:bg-white">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <Globe className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <span className="truncate text-sm text-slate-600">{url}</span>
                      </div>
                      {editingId === group.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => removeFeed(url)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {(editingId === group.id ? editForm?.feeds.length === 0 : group.feeds.length === 0) && (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-slate-400">
                      No RSS feeds added to this group.
                    </div>
                  )}
                </div>
                {editingId === group.id && (
                  <div className="flex gap-2">
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
                    />
                    <Button variant="secondary" onClick={addFeed}>Add Feed</Button>
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
