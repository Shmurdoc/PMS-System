import { toast } from 'sonner';

export const toastHelpers = {
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 3000,
    });
  },

  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 5000,
    });
  },

  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 3000,
    });
  },

  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
    });
  },

  // Booking specific
  booking: {
    created: () => toast.success('Booking created', { description: 'New booking has been successfully created' }),
    updated: () => toast.success('Booking updated', { description: 'Booking details have been updated' }),
    deleted: () => toast.success('Booking cancelled', { description: 'Booking has been cancelled' }),
    checkedIn: () => toast.success('Check-in complete', { description: 'Guest has been checked in' }),
    checkedOut: () => toast.success('Check-out complete', { description: 'Guest has been checked out' }),
    confirmed: () => toast.success('Booking confirmed', { description: 'Booking status updated to confirmed' }),
  },

  // Guest specific
  guest: {
    created: () => toast.success('Guest added', { description: 'New guest profile has been created' }),
    updated: () => toast.success('Guest updated', { description: 'Guest profile has been updated' }),
    deleted: () => toast.success('Guest removed', { description: 'Guest has been removed from the system' }),
  },

  // Room specific
  room: {
    created: () => toast.success('Room added', { description: 'New room has been created' }),
    updated: () => toast.success('Room updated', { description: 'Room details have been updated' }),
    deleted: () => toast.success('Room removed', { description: 'Room has been removed from the system' }),
    statusChanged: () => toast.success('Room status updated', { description: 'Room status has been changed' }),
  },

  // Integration specific
  integration: {
    connected: (name: string) => toast.success(`${name} connected`, { description: 'Integration is now active' }),
    disconnected: (name: string) => toast.success(`${name} disconnected`, { description: 'Integration has been disconnected' }),
    error: (name: string) => toast.error(`${name} error`, { description: 'There was an issue with the integration' }),
  },

  // Settings
  settings: {
    saved: () => toast.success('Settings saved', { description: 'Your changes have been saved successfully' }),
    reset: () => toast.info('Settings reset', { description: 'Settings have been reset to defaults' }),
  },

  // General actions
  action: {
    save: () => toast.success('Saved', { description: 'Changes have been saved' }),
    delete: () => toast.success('Deleted', { description: 'Item has been deleted' }),
    copy: () => toast.success('Copied', { description: 'Content copied to clipboard' }),
    export: () => toast.success('Export complete', { description: 'Your data has been exported' }),
  },
};

export default toastHelpers;
