import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Search, Send, Paperclip, Smile,
  Phone, Video, MoreVertical,
  Check, CheckCheck, Users, X,
  Trash2, Eye, FileText, Image, Film, Music,
  User, Ban, Pin, PhoneOff, VideoOff, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../store/useAppStore';
import { newId } from '../utils/id';

const CURRENT_USER_ID = '1';

const EMOJI_LIST = [
  '😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🔥',
  '🎉', '✅', '⭐', '💯', '🙏', '👋', '😊', '😢', '🤝', '💪',
  '🏨', '🛏️', '🔑', '🧹', '📋', '☕', '🍽️', '🎯', '📞', '💼',
];

export default function Messaging() {
  const {
    messages, users, addMessage, deleteMessage, markMessageRead, addAuditLog
  } = useAppStore();
  const role = useAppStore((s) => s.user?.role);
  const canManage = role === 'admin' || role === 'manager';

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMsgRecipient, setNewMsgRecipient] = useState('');
  const [newMsgContent, setNewMsgContent] = useState('');

  // Feature modals
  const [showCallingModal, setShowCallingModal] = useState(false);
  const [callType, setCallType] = useState<'phone' | 'video'>('phone');
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(new Set());
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node)) {
        setShowAttachmentMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  // Build conversations: between current user and each other user
  const otherUsers = users.filter(u => u.id !== CURRENT_USER_ID);

  const conversations = otherUsers.map(user => {
    const userMessages = messages.filter(
      m => (m.senderId === user.id && (!m.channelId || m.channelId === CURRENT_USER_ID)) ||
           (m.senderId === CURRENT_USER_ID && m.channelId === user.id)
    );
    const lastMessage = userMessages.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
    const unreadCount = userMessages.filter(m => !m.read && m.senderId === user.id).length;
    return { user, lastMessage, unreadCount };
  }).sort((a, b) => {
    // Pinned first
    const aPinned = pinnedConversations.has(a.user.id) ? 1 : 0;
    const bPinned = pinnedConversations.has(b.user.id) ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    // Then by last message time
    const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
    const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  const filteredConversations = conversations.filter(c =>
    c.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedUser = selectedConversation
    ? users.find(u => u.id === selectedConversation) ?? null
    : null;

  const selectedMessages = selectedUser
    ? messages
        .filter(
          m => (m.senderId === selectedUser.id && (!m.channelId || m.channelId === CURRENT_USER_ID)) ||
               (m.senderId === CURRENT_USER_ID && m.channelId === selectedUser.id)
        )
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const handleSendMessage = useCallback((content?: string, recipientId?: string) => {
    const text = content ?? newMessage;
    const recipient = recipientId ?? selectedConversation;
    if (!text.trim() || !recipient) return;
    const recipientUser = users.find(u => u.id === recipient);
    const message = {
      id: newId('msg'),
      senderId: CURRENT_USER_ID,
      senderName: users.find(u => u.id === CURRENT_USER_ID)?.name ?? 'You',
      content: text,
      timestamp: new Date().toISOString(),
      read: false,
      channelId: recipient,
      type: 'text' as const,
    };
    addMessage(message);
    addAuditLog({
      id: newId('log'),
      action: 'send_message',
      entityType: 'user',
      entityId: recipient,
      entityName: recipientUser?.name ?? 'Unknown',
      userId: CURRENT_USER_ID,
      userName: users.find(u => u.id === CURRENT_USER_ID)?.name ?? 'System',
      userRole: users.find(u => u.id === CURRENT_USER_ID)?.role ?? 'System',
      details: `Sent message to ${recipientUser?.name ?? 'Unknown'}`,
      timestamp: new Date().toISOString(),
    });
    if (!content) setNewMessage('');
  }, [newMessage, selectedConversation, users, addMessage, addAuditLog]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  // Phone / Video Call
  const startCall = (type: 'phone' | 'video') => {
    if (!selectedUser) return;
    setCallType(type);
    setCallStatus('ringing');
    setShowCallingModal(true);
    setShowMoreMenu(false);
    // Simulate: ring for 1.5s, connect for 3s, then end
    setTimeout(() => setCallStatus('connected'), 1500);
    setTimeout(() => {
      setCallStatus('ended');
      setTimeout(() => {
        setShowCallingModal(false);
        toast.success(`${type === 'phone' ? 'Phone' : 'Video'} call with ${selectedUser.name} ended`);
        addAuditLog({
          id: `log-${Date.now()}`,
          action: `${type}_call`,
          entityType: 'user',
          entityId: selectedUser.id,
          entityName: selectedUser.name,
          userId: CURRENT_USER_ID,
          userName: users.find(u => u.id === CURRENT_USER_ID)?.name ?? 'System',
          userRole: users.find(u => u.id === CURRENT_USER_ID)?.role ?? 'System',
          details: `${type === 'phone' ? 'Phone' : 'Video'} call with ${selectedUser.name}`,
          timestamp: new Date().toISOString(),
        });
      }, 1000);
    }, 4500);
  };

  const hangUp = () => {
    setShowCallingModal(false);
    setCallStatus('ended');
    toast.info('Call ended');
  };

  // More menu actions
  const handleViewProfile = () => {
    setShowMoreMenu(false);
    setShowUserProfileModal(true);
  };

  const handleClearChat = () => {
    if (!selectedUser) return;
    const chatMsgs = messages.filter(
      m => (m.senderId === selectedUser.id && (!m.channelId || m.channelId === CURRENT_USER_ID)) ||
           (m.senderId === CURRENT_USER_ID && m.channelId === selectedUser.id)
    );
    chatMsgs.forEach(m => deleteMessage(m.id));
    setShowMoreMenu(false);
    toast.success(`Chat with ${selectedUser.name} cleared`);
    addAuditLog({
      id: newId('log'),
      action: 'clear_chat',
      entityType: 'user',
      entityId: selectedUser.id,
      entityName: selectedUser.name,
      userId: CURRENT_USER_ID,
      userName: users.find(u => u.id === CURRENT_USER_ID)?.name ?? 'System',
      userRole: users.find(u => u.id === CURRENT_USER_ID)?.role ?? 'System',
      details: `Cleared chat history with ${selectedUser.name}`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleBlockUser = () => {
    if (!selectedUser) return;
    setShowMoreMenu(false);
    toast.info(`${selectedUser.name} has been blocked. They will not be able to send you messages.`);
  };

  const handlePinConversation = () => {
    if (!selectedUser) return;
    setShowMoreMenu(false);
    setPinnedConversations(prev => {
      const next = new Set(prev);
      if (next.has(selectedUser.id)) {
        next.delete(selectedUser.id);
        toast.info(`Unpinned conversation with ${selectedUser.name}`);
      } else {
        next.add(selectedUser.id);
        toast.success(`Pinned conversation with ${selectedUser.name}`);
      }
      return next;
    });
  };

  // Attachment handler
  const handleAttachment = (type: string) => {
    if (!selectedConversation) return;
    setShowAttachmentMenu(false);
    const fileNames: Record<string, string> = {
      Document: 'report.pdf',
      Image: 'photo.jpg',
      Video: 'recording.mp4',
      Audio: 'voice-note.mp3',
    };
    const fileName = fileNames[type] ?? 'file.bin';
    const content = `[Attached: ${fileName}]`;
    const recipientUser = users.find(u => u.id === selectedConversation);
    const message = {
      id: newId('msg'),
      senderId: CURRENT_USER_ID,
      senderName: users.find(u => u.id === CURRENT_USER_ID)?.name ?? 'You',
      content,
      timestamp: new Date().toISOString(),
      read: false,
      channelId: selectedConversation,
      type: 'text' as const,
      attachments: [fileName],
    };
    addMessage(message);
    toast.success(`${type} "${fileName}" attached and sent`);
    addAuditLog({
      id: newId('log'),
      action: 'send_attachment',
      entityType: 'user',
      entityId: selectedConversation,
      entityName: recipientUser?.name ?? 'Unknown',
      userId: CURRENT_USER_ID,
      userName: users.find(u => u.id === CURRENT_USER_ID)?.name ?? 'System',
      userRole: users.find(u => u.id === CURRENT_USER_ID)?.role ?? 'System',
      details: `Sent ${type.toLowerCase()} attachment to ${recipientUser?.name ?? 'Unknown'}`,
      timestamp: new Date().toISOString(),
    });
  };

  // Emoji handler
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Message actions
  const handleDeleteMessage = (msgId: string) => {
    deleteMessage(msgId);
    toast.success('Message deleted');
  };

  const handleMarkAsRead = (msgId: string) => {
    markMessageRead(msgId);
    toast.success('Message marked as read');
  };

  // New message modal send
  const handleNewMessageSend = () => {
    if (!newMsgRecipient || !newMsgContent.trim()) return;
    handleSendMessage(newMsgContent, newMsgRecipient);
    setSelectedConversation(newMsgRecipient);
    setNewMsgRecipient('');
    setNewMsgContent('');
    setShowNewMessage(false);
    toast.success('Message sent');
  };

  // Message type styling
  const getMessageTypeStyle = (msg: { type?: string }) => {
    if (msg.type === 'system') return 'border-l-4 border-warning bg-warning/10';
    if (msg.type === 'alert') return 'border-l-4 border-danger bg-danger/10';
    return '';
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Conversation List Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-card border border-border rounded-xl flex flex-col overflow-hidden"
            style={{ minWidth: 0 }}
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Messages
                </h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1 hover:bg-muted rounded transition-colors lg:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No conversations found
                </div>
              )}
              {filteredConversations.map((conv) => {
                const isOnline = conv.user.status === 'active';
                const isPinned = pinnedConversations.has(conv.user.id);
                return (
                  <motion.button
                    key={conv.user.id}
                    onClick={() => setSelectedConversation(conv.user.id)}
                    className={`w-full p-4 text-left hover:bg-primary/5 transition-colors border-b border-border/20 ${
                      selectedConversation === conv.user.id ? 'bg-muted' : ''
                    }`}
                    whileHover={{ x: 2 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm">
                          {conv.user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                          isOnline ? 'bg-success' : 'bg-muted-foreground'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <h3 className="font-medium truncate">{conv.user.name}</h3>
                            {isPinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage?.content ?? 'No messages yet'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {conv.user.role} · {isOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* New Message Button */}
            <div className="p-4 border-t border-border/30">
              <button
                onClick={() => setShowNewMessage(true)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                New Message
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!showSidebar && (
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                )}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
                    {selectedUser.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                    selectedUser.status === 'active' ? 'bg-success' : 'bg-muted-foreground'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {selectedUser.name}
                    {pinnedConversations.has(selectedUser.id) && (
                      <Pin className="w-3 h-3 text-primary" />
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedUser.role} · {selectedUser.status === 'active' ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startCall('phone')}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Phone Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => startCall('video')}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="More Options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  <AnimatePresence>
                    {showMoreMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-xl shadow-overlay border border-border/30 overflow-hidden z-50"
                      >
                        <button
                          onClick={handleViewProfile}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                        >
                          <User className="w-4 h-4" />
                          View Profile
                        </button>
                        <button
                          onClick={handleClearChat}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Clear Chat
                        </button>
                        <button
                          onClick={handleBlockUser}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 text-danger"
                        >
                          <Ban className="w-4 h-4" />
                          Block User
                        </button>
                        <button
                          onClick={handlePinConversation}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                        >
                          <Pin className="w-4 h-4" />
                          {pinnedConversations.has(selectedUser.id) ? 'Unpin Conversation' : 'Pin Conversation'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              )}
              {selectedMessages.map((msg) => {
                const isOwn = msg.senderId === CURRENT_USER_ID;
                const typeStyle = getMessageTypeStyle(msg);
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    <div className={`max-w-[70%] relative ${isOwn ? 'order-2' : 'order-1'}`}>
                      <div className={`p-3 rounded-2xl ${
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      } ${typeStyle}`}>
                        {msg.type === 'system' && (
                          <span className="text-xs font-bold text-warning block mb-1">ANNOUNCEMENT</span>
                        )}
                        {msg.type === 'alert' && (
                          <span className="text-xs font-bold text-danger block mb-1">ALERT</span>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-xs opacity-75">
                            <Paperclip className="w-3 h-3" />
                            {msg.attachments.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${isOwn ? 'justify-end' : ''}`}>
                        <span>{formatTime(msg.timestamp)}</span>
                        {isOwn && (
                          msg.read ? <CheckCheck className="w-3 h-3 text-primary" /> : <Check className="w-3 h-3" />
                        )}
                      </div>

                      {/* Message hover actions */}
                      <AnimatePresence>
                        {hoveredMessageId === msg.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={`absolute top-0 ${isOwn ? '-left-20' : '-right-20'} flex gap-1`}
                          >
                            {canManage && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1.5 bg-danger/15 hover:bg-danger/30 text-danger rounded-lg transition-colors"
                                title="Delete message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {!msg.read && !isOwn && (
                              <button
                                onClick={() => handleMarkAsRead(msg.id)}
                                className="p-1.5 bg-info/15 hover:bg-info/30 text-info rounded-lg transition-colors"
                                title="Mark as read"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-border/30">
              <div className="flex items-center gap-3">
                {/* Attachment button */}
                <div className="relative" ref={attachmentMenuRef}>
                  <button
                    onClick={() => { setShowAttachmentMenu(!showAttachmentMenu); setShowEmojiPicker(false); }}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <AnimatePresence>
                    {showAttachmentMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 4 }}
                        className="absolute bottom-full mb-2 left-0 w-48 bg-popover border border-border rounded-xl shadow-overlay border border-border/30 overflow-hidden z-50"
                      >
                        {[
                          { type: 'Document', icon: FileText, color: 'text-info' },
                          { type: 'Image', icon: Image, color: 'text-success' },
                          { type: 'Video', icon: Film, color: 'text-purple-400' },
                          { type: 'Audio', icon: Music, color: 'text-orange-400' },
                        ].map(item => (
                          <button
                            key={item.type}
                            onClick={() => handleAttachment(item.type)}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                          >
                            <item.icon className={`w-4 h-4 ${item.color}`} />
                            {item.type}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>

                {/* Emoji picker button */}
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachmentMenu(false); }}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="Add emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 4 }}
                        className="absolute bottom-full mb-2 right-0 w-72 bg-popover border border-border rounded-xl shadow-overlay border border-border/30 p-3 z-50"
                      >
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Emoji</p>
                        <div className="grid grid-cols-6 gap-1">
                          {EMOJI_LIST.map((emoji, i) => (
                            <button
                              key={i}
                              onClick={() => handleEmojiSelect(emoji)}
                              className="p-1.5 hover:bg-muted rounded-lg transition-colors text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!newMessage.trim()}
                  className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select a conversation from the sidebar or start a new message
            </p>
            <div className="flex gap-3">
              {!showSidebar && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Open Sidebar
                </button>
              )}
              <button
                onClick={() => setShowNewMessage(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
              >
                New Message
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calling Modal */}
      <AnimatePresence>
        {showCallingModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={hangUp} />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-sm m-4 p-8 text-center"
            >
              <div className="mb-6">
                {callType === 'video' ? (
                  <Camera className="w-12 h-12 mx-auto text-primary mb-2" />
                ) : (
                  <Phone className="w-12 h-12 mx-auto text-primary mb-2" />
                )}
                <h2 className="text-xl font-bold mb-1">
                  {callType === 'phone' ? 'Phone Call' : 'Video Call'}
                </h2>
                <p className="text-lg font-medium">{selectedUser.name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.role}</p>
              </div>

              {/* Call status */}
              <div className="mb-6">
                {callStatus === 'ringing' && (
                  <div className="flex flex-col items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
                        className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center"
                      >
                        {callType === 'phone' ? (
                          <Phone className="w-5 h-5 text-primary" />
                        ) : (
                          <Video className="w-5 h-5 text-primary" />
                        )}
                      </motion.div>
                    </motion.div>
                    <p className="text-sm text-muted-foreground animate-pulse">Ringing...</p>
                  </div>
                )}
                {callStatus === 'connected' && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
                      {callType === 'phone' ? (
                        <Phone className="w-6 h-6 text-success" />
                      ) : (
                        <Video className="w-6 h-6 text-success" />
                      )}
                    </div>
                    <p className="text-sm text-success font-medium">Connected</p>
                  </div>
                )}
                {callStatus === 'ended' && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-danger/15 flex items-center justify-center">
                      {callType === 'phone' ? (
                        <PhoneOff className="w-6 h-6 text-danger" />
                      ) : (
                        <VideoOff className="w-6 h-6 text-danger" />
                      )}
                    </div>
                    <p className="text-sm text-danger font-medium">Call Ended</p>
                  </div>
                )}
              </div>

              {callStatus !== 'ended' && (
                <button
                  onClick={hangUp}
                  className="px-6 py-3 bg-destructive text-destructive-foreground rounded-full hover:bg-danger/90 transition-colors flex items-center gap-2 mx-auto"
                >
                  <PhoneOff className="w-4 h-4" />
                  Hang Up
                </button>
              )}
              {callStatus === 'ended' && (
                <button
                  onClick={() => setShowCallingModal(false)}
                  className="px-6 py-3 bg-muted rounded-full hover:bg-muted/80 transition-colors mx-auto"
                >
                  Close
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile Modal */}
      <AnimatePresence>
        {showUserProfileModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUserProfileModal(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md m-4 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">User Profile</h2>
                <button onClick={() => setShowUserProfileModal(false)} className="p-1 hover:bg-muted rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-2xl mb-3">
                  {selectedUser.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedUser.role}</p>
                <span className={`mt-2 text-xs px-3 py-1 rounded-full ${
                  selectedUser.status === 'active'
                    ? 'bg-success/15 text-success'
                    : selectedUser.status === 'on_leave'
                    ? 'bg-warning/15 text-warning'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {selectedUser.status === 'active' ? 'Online' : selectedUser.status === 'on_leave' ? 'On Leave' : 'Offline'}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Department</span>
                  <span className="text-sm font-medium">{selectedUser.department}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <span className="text-sm font-medium">{selectedUser.phone}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Hire Date</span>
                  <span className="text-sm font-medium">{new Date(selectedUser.hireDate).toLocaleDateString()}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Message Modal */}
      <AnimatePresence>
        {showNewMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewMessage(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md m-4 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">New Message</h2>
                <button onClick={() => setShowNewMessage(false)} className="p-1 hover:bg-muted rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">To:</label>
                  <select
                    value={newMsgRecipient}
                    onChange={(e) => setNewMsgRecipient(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  >
                    <option value="">Select recipient...</option>
                    {otherUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Message:</label>
                  <textarea
                    placeholder="Type your message..."
                    value={newMsgContent}
                    onChange={(e) => setNewMsgContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleNewMessageSend();
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors min-h-[120px] resize-none"
                  />
                </div>
                <button
                  onClick={handleNewMessageSend}
                  disabled={!newMsgRecipient || !newMsgContent.trim()}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
