import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, Building2, Bell, Lock, Save, Clock
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';

export default function Settings() {
  const { properties, settings, updateSettings, updateProperty } = useAppStore();
  const [activeTab, setActiveTab] = useState<'general' | 'property' | 'notifications' | 'security'>('general');
  const [saving, setSaving] = useState(false);

  // Local state initialized from store
  const [localSettings, setLocalSettings] = useState({
    propertyName: settings.propertyName || 'NEXUS PMS',
    currency: settings.currency || 'ZAR',
    timezone: settings.timezone || 'Africa/Johannesburg',
    dateFormat: settings.dateFormat || 'YYYY-MM-DD',
    language: settings.language || 'en',
    checkInTime: settings.checkInTime || '14:00',
    checkOutTime: settings.checkOutTime || '11:00',
    vatRate: settings.vatRate ?? 15,
    tourismLevy: settings.tourismLevy ?? 1,
    maintenanceMode: settings.maintenanceMode ?? false,
    backupFrequency: settings.backupFrequency || 'daily',
  });

  const [notifSettings, setNotifSettings] = useState({
    email: settings.notifications?.email ?? true,
    sms: settings.notifications?.sms ?? false,
    push: settings.notifications?.push ?? true,
    aiSmartRecommendations: settings.aiSmartRecommendations ?? true,
    aiAutoResponses: settings.aiAutoResponses ?? true,
    aiPredictiveAnalytics: settings.aiPredictiveAnalytics ?? true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: '30',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Property editing state
  const [propertyEdits, setPropertyEdits] = useState<Record<string, { name: string; totalRooms: number; address: string; phone: string; email: string; checkInTime: string; checkOutTime: string }>>({});

  const getPropertyEdit = (property: typeof properties[0]) => {
    if (!propertyEdits[property.id]) {
      return {
        name: property.name,
        totalRooms: property.totalRooms,
        address: property.address,
        phone: property.phone || '',
        email: property.email || '',
        checkInTime: property.checkInTime || '14:00',
        checkOutTime: property.checkOutTime || '11:00',
      };
    }
    return propertyEdits[property.id];
  };

  const setPropertyEdit = (propertyId: string, field: string, value: string | number) => {
    const property = properties.find(p => p.id === propertyId)!;
    const current = getPropertyEdit(property);
    setPropertyEdits(prev => ({
      ...prev,
      [propertyId]: { ...current, [field]: value },
    }));
  };

  const saveGeneralSettings = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    updateSettings({
      propertyName: localSettings.propertyName,
      currency: localSettings.currency,
      timezone: localSettings.timezone,
      dateFormat: localSettings.dateFormat,
      language: localSettings.language,
      checkInTime: localSettings.checkInTime,
      checkOutTime: localSettings.checkOutTime,
      vatRate: localSettings.vatRate,
      tourismLevy: localSettings.tourismLevy,
      maintenanceMode: localSettings.maintenanceMode,
      backupFrequency: localSettings.backupFrequency,
    });
    setSaving(false);
    toast.success('General settings saved successfully');
  };

  const savePropertySettings = async (propertyId: string) => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    const edits = getPropertyEdit(properties.find(p => p.id === propertyId)!);
    updateProperty(propertyId, {
      name: edits.name,
      totalRooms: edits.totalRooms,
      address: edits.address,
      phone: edits.phone,
      email: edits.email,
      checkInTime: edits.checkInTime,
      checkOutTime: edits.checkOutTime,
    });
    setSaving(false);
    toast.success('Property settings saved successfully');
  };

  const saveNotificationSettings = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    updateSettings({
      notifications: {
        email: notifSettings.email,
        sms: notifSettings.sms,
        push: notifSettings.push,
      },
      aiSmartRecommendations: notifSettings.aiSmartRecommendations,
      aiAutoResponses: notifSettings.aiAutoResponses,
      aiPredictiveAnalytics: notifSettings.aiPredictiveAnalytics,
    });
    setSaving(false);
    toast.success('Notification preferences saved successfully');
  };

  const saveSecuritySettings = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    setSaving(false);
    toast.success('Security settings saved successfully');
  };

  const updatePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setSaving(false);
    toast.success('Password updated successfully');
  };

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'property', label: 'Properties', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your system preferences and configurations</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-64 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {activeTab === 'general' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-6 space-y-6"
            >
              <h2 className="font-semibold text-lg">General Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Company Name</label>
                  <input
                    type="text"
                    value={localSettings.propertyName}
                    onChange={(e) => setLocalSettings({ ...localSettings, propertyName: e.target.value })}
                    placeholder="Enter company name"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Currency</label>
                  <select
                    value={localSettings.currency}
                    onChange={(e) => setLocalSettings({ ...localSettings, currency: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  >
                    <option value="ZAR">ZAR - South African Rand</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Timezone</label>
                  <select
                    value={localSettings.timezone}
                    onChange={(e) => setLocalSettings({ ...localSettings, timezone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  >
                    <option value="Africa/Johannesburg">Africa/Johannesburg (GMT+2)</option>
                    <option value="Africa/Cape_Town">Africa/Cape Town (GMT+2)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="Europe/London">Europe/London (GMT+0)</option>
                    <option value="America/New_York">America/New York (GMT-5)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date Format</label>
                  <select
                    value={localSettings.dateFormat}
                    onChange={(e) => setLocalSettings({ ...localSettings, dateFormat: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Default Check-in Time</label>
                  <input
                    type="time"
                    value={localSettings.checkInTime}
                    onChange={(e) => setLocalSettings({ ...localSettings, checkInTime: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Default Check-out Time</label>
                  <input
                    type="time"
                    value={localSettings.checkOutTime}
                    onChange={(e) => setLocalSettings({ ...localSettings, checkOutTime: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">VAT Rate (%)</label>
                  <input
                    type="number"
                    value={localSettings.vatRate}
                    onChange={(e) => setLocalSettings({ ...localSettings, vatRate: parseFloat(e.target.value) || 0 })}
                    min={0} max={100} step={0.5}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Tourism Levy (%)</label>
                  <input
                    type="number"
                    value={localSettings.tourismLevy}
                    onChange={(e) => setLocalSettings({ ...localSettings, tourismLevy: parseFloat(e.target.value) || 0 })}
                    min={0} max={100} step={0.5}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <h4 className="font-medium">Maintenance Mode</h4>
                  <p className="text-sm text-muted-foreground">Temporarily disable guest-facing features</p>
                </div>
                <button
                  onClick={() => setLocalSettings({ ...localSettings, maintenanceMode: !localSettings.maintenanceMode })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    localSettings.maintenanceMode ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    localSettings.maintenanceMode ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <button
                onClick={saveGeneralSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </motion.div>
          )}

          {activeTab === 'property' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h2 className="font-semibold text-lg">Property Settings</h2>
              
              {properties.map(property => {
                const edit = getPropertyEdit(property);
                return (
                  <div key={property.id} className="bg-card border border-border rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden">
                        {property.image ? (
                          <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-8 h-8 text-primary" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">{property.name}</h3>
                        <p className="text-sm text-muted-foreground">{property.address}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${property.status === 'operational' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                          {property.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Property Name</label>
                        <input
                          type="text"
                          value={edit.name}
                          onChange={(e) => setPropertyEdit(property.id, 'name', e.target.value)}
                          className="w-full px-4 py-2.5 bg-card border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Total Rooms</label>
                        <input
                          type="number"
                          value={edit.totalRooms}
                          onChange={(e) => setPropertyEdit(property.id, 'totalRooms', parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 bg-card border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium mb-2 block">Address</label>
                        <input
                          type="text"
                          value={edit.address}
                          onChange={(e) => setPropertyEdit(property.id, 'address', e.target.value)}
                          className="w-full px-4 py-2.5 bg-card border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Phone</label>
                        <input
                          type="tel"
                          value={edit.phone}
                          onChange={(e) => setPropertyEdit(property.id, 'phone', e.target.value)}
                          placeholder="+27 XX XXX XXXX"
                          className="w-full px-4 py-2.5 bg-card border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Email</label>
                        <input
                          type="email"
                          value={edit.email}
                          onChange={(e) => setPropertyEdit(property.id, 'email', e.target.value)}
                          placeholder="property@nexus.com"
                          className="w-full px-4 py-2.5 bg-card border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Check-in Time</label>
                        <input
                          type="time"
                          value={edit.checkInTime}
                          onChange={(e) => setPropertyEdit(property.id, 'checkInTime', e.target.value)}
                          className="w-full px-4 py-2.5 bg-card border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Check-out Time</label>
                        <input
                          type="time"
                          value={edit.checkOutTime}
                          onChange={(e) => setPropertyEdit(property.id, 'checkOutTime', e.target.value)}
                          className="w-full px-4 py-2.5 bg-card border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => savePropertySettings(property.id)}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50"
                    >
                      {saving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? 'Saving...' : 'Save Property'}
                    </button>
                  </div>
                );
              })}
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-6 space-y-6"
            >
              <h2 className="font-semibold text-lg">Notification Preferences</h2>
              
              <div className="space-y-4">
                {[
                  { key: 'email', label: 'Email Notifications', desc: 'Receive notifications via email' },
                  { key: 'sms', label: 'SMS Notifications', desc: 'Receive notifications via SMS' },
                  { key: 'push', label: 'Push Notifications', desc: 'Receive browser push notifications' },
                  { key: 'aiSmartRecommendations', label: 'AI Smart Recommendations', desc: 'Get AI-powered suggestions for operations' },
                  { key: 'aiAutoResponses', label: 'AI Auto Responses', desc: 'Automatically respond to guest inquiries' },
                  { key: 'aiPredictiveAnalytics', label: 'AI Predictive Analytics', desc: 'Forecasting and predictive insights' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <h4 className="font-medium">{item.label}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        notifSettings[item.key as keyof typeof notifSettings] ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notifSettings[item.key as keyof typeof notifSettings] ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={saveNotificationSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-6 space-y-6"
            >
              <h2 className="font-semibold text-lg">Security Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <h4 className="font-medium">Two-Factor Authentication</h4>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <button
                    onClick={() => setSecuritySettings(prev => ({ ...prev, twoFactorAuth: !prev.twoFactorAuth }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      securitySettings.twoFactorAuth ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      securitySettings.twoFactorAuth ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Session Timeout (minutes)</label>
                  <select
                    value={securitySettings.sessionTimeout}
                    onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: e.target.value }))}
                    className="w-full max-w-xs px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>

                <button
                  onClick={saveSecuritySettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50"
                >
                  {saving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Security Settings'}
                </button>

                <div className="pt-4 border-t border-border/30">
                  <h4 className="font-medium mb-3">Change Password</h4>
                  <div className="space-y-3 max-w-md">
                    <input
                      type="password"
                      placeholder="Current password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    />
                    <input
                      type="password"
                      placeholder="New password (min 8 characters)"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    />
                    <button
                      onClick={updatePassword}
                      disabled={saving}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
