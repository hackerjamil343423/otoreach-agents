# Claude Code Session Context

## What We Were Working On

### Issue
Each message was generating a new session_id. The user wanted:
- Each new chat page to have its own chat_id
- All messages within the same chat page to use the SAME session_id

### Changes Made

#### 1. `src/components/chat/interface.ts`
Added `sessionId` to the Chat interface:
```typescript
export interface Chat {
  id: string
  sessionId?: string  // NEW
  createdAt: string
  updatedAt: string
  title: string
  persona?: Persona
}
```

#### 2. `src/components/chat/useChatHook.ts`
Updated to generate `sessionId` when creating new chats:
- `onCreateChat`: Now generates both `id` and `sessionId` when creating a new chat
- `onDeleteChat`: When creating a replacement chat, includes `sessionId`
- Initial default chat: Now includes `sessionId`
- `saveMessages`: When creating a new chat entry, includes `sessionId`

#### 3. `src/app/api/chat/route.ts` (already updated previously)
- Accepts `chatId` from request
- Gets session_id from the chat and sends it to the webhook with just `input`
- Does NOT create new session IDs anymore

#### 4. `src/components/chat/chat.tsx` (already updated)
- `sendChatMessage` function now sends `{ input, agentId, chatId }` instead of past messages

### Expected Behavior Now
1. When user creates a new chat, a `sessionId` is generated
2. All messages in that chat use the SAME `sessionId`
3. The webhook receives: `{ session_id: "...", input: {...} }`
4. No past messages are sent to the webhook

### Database Migration Needed
Run this in Neon SQL editor:
```sql
ALTER TABLE chats ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
```

### Files Modified
- `src/components/chat/interface.ts` - Added sessionId to Chat interface
- `src/components/chat/useChatHook.ts` - Generate sessionId on chat creation
- `src/app/api/chat/route.ts` - Use sessionId from chat, don't generate new ones
- `src/components/chat/chat.tsx` - Send chatId to API
