import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Link, 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink,
  Save,
  X,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface ContactLink {
  id: string;
  platform: string;
  display_name: string;
  url: string;
  icon_emoji: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const ContactInfo = () => {
  const [contacts, setContacts] = useState<ContactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    platform: '',
    display_name: '',
    url: '',
    icon_emoji: ''
  });
  const { toast } = useToast();

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_links')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Error",
        description: "Failed to load contact information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSave = async (contactId?: string) => {
    try {
      if (!formData.platform || !formData.display_name || !formData.url) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }

      const dataToSave = {
        platform: formData.platform,
        display_name: formData.display_name,
        url: formData.url,
        icon_emoji: formData.icon_emoji || '🔗',
        is_active: true,
        display_order: contactId ? undefined : contacts.length + 1
      };

      let result;
      if (contactId) {
        // Update existing
        result = await supabase
          .from('contact_links')
          .update(dataToSave)
          .eq('id', contactId);
      } else {
        // Create new
        result = await supabase
          .from('contact_links')
          .insert(dataToSave);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: contactId ? "Contact updated successfully" : "Contact created successfully"
      });

      setEditingId(null);
      setIsCreating(false);
      setFormData({ platform: '', display_name: '', url: '', icon_emoji: '' });
      fetchContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast({
        title: "Error",
        description: "Failed to save contact information",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('contact_links')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Contact deleted successfully"
      });

      fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive"
      });
    }
  };

  const handleToggleActive = async (contactId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('contact_links')
        .update({ is_active: !currentStatus })
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Contact ${!currentStatus ? 'activated' : 'deactivated'} successfully`
      });

      fetchContacts();
    } catch (error) {
      console.error('Error toggling contact status:', error);
      toast({
        title: "Error",
        description: "Failed to update contact status",
        variant: "destructive"
      });
    }
  };

  const handleReorder = async (contactId: string, direction: 'up' | 'down') => {
    const currentIndex = contacts.findIndex(c => c.id === contactId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= contacts.length) return;

    const newContacts = [...contacts];
    [newContacts[currentIndex], newContacts[targetIndex]] = [newContacts[targetIndex], newContacts[currentIndex]];

    try {
      // Update display_order for both contacts
      const updates = newContacts.map((contact, index) => 
        supabase
          .from('contact_links')
          .update({ display_order: index + 1 })
          .eq('id', contact.id)
      );

      await Promise.all(updates);
      fetchContacts();
    } catch (error) {
      console.error('Error reordering contacts:', error);
      toast({
        title: "Error",
        description: "Failed to reorder contacts",
        variant: "destructive"
      });
    }
  };

  const startEdit = (contact: ContactLink) => {
    setEditingId(contact.id);
    setFormData({
      platform: contact.platform,
      display_name: contact.display_name,
      url: contact.url,
      icon_emoji: contact.icon_emoji
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ platform: '', display_name: '', url: '', icon_emoji: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contact Information</h2>
          <p className="text-muted-foreground">Manage bot contact links and social media</p>
        </div>
        <Button 
          onClick={() => setIsCreating(true)} 
          disabled={isCreating || editingId !== null}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Create New Contact Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Contact</CardTitle>
            <CardDescription>Create a new contact link for the bot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Platform</label>
                <Input
                  placeholder="e.g., telegram, instagram, facebook"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  placeholder="e.g., Dynamic Capital Instagram"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">URL</label>
                <Input
                  placeholder="https://..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Icon Emoji</label>
                <Input
                  placeholder="📸"
                  value={formData.icon_emoji}
                  onChange={(e) => setFormData({ ...formData, icon_emoji: e.target.value })}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={() => handleSave()}>
                <Save className="w-4 h-4 mr-2" />
                Save Contact
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact List */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Links ({contacts.length})</CardTitle>
          <CardDescription>Active contact information displayed to users</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {contacts.map((contact, index) => (
                <div key={contact.id} className="border rounded-lg p-4">
                  {editingId === contact.id ? (
                    /* Edit Form */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Platform</label>
                          <Input
                            value={formData.platform}
                            onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Display Name</label>
                          <Input
                            value={formData.display_name}
                            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">URL</label>
                          <Input
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Icon Emoji</label>
                          <Input
                            value={formData.icon_emoji}
                            onChange={(e) => setFormData({ ...formData, icon_emoji: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => handleSave(contact.id)}>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{contact.icon_emoji}</span>
                        <div>
                          <h3 className="font-medium">{contact.display_name}</h3>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <span>{contact.platform}</span>
                            <span>•</span>
                            <a 
                              href={contact.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center hover:text-primary"
                            >
                              Visit <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={contact.is_active ? "default" : "secondary"}>
                          {contact.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReorder(contact.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReorder(contact.id, 'down')}
                            disabled={index === contacts.length - 1}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(contact.id, contact.is_active)}
                          >
                            {contact.is_active ? "Hide" : "Show"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(contact)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(contact.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {contacts.length === 0 && (
                <div className="text-center py-8">
                  <Link className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No contact links found</p>
                  <p className="text-sm text-muted-foreground">Add your first contact link to get started</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};