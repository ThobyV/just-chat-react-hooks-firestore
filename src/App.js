import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, withRouter, Route, Redirect, Link, Switch } from "react-router-dom";
import Media from "react-media";
import firebase from './Firebase/firebaseConfig'

import {
  google_auth_provider,
  firestoreDb,
  usersCollection,
  chatsCollection,
} from './Firebase/firebaseConfig'


import { useChatState, useAuthState } from './AppContext'
import { ChatProvider, AuthProvider } from './AppContext'

import { v4 as uuidv1 } from 'uuid'

import pager_emoji_svg from './pager_emoji_svg.svg'
import cat_emoji_svg from './cat_emoji_svg.svg'
import message_emoji_svg from './message_emoji_svg.svg'

function trimString(str, max_length) {
  var str_len = str.length;
  if (str_len > max_length) {
    var dots = '...'
    return str.substring(0, max_length) + dots;
  } else {
    return str
  }
}

function getDate(timestamp) {
  var date = new Date(timestamp);
  var options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}

function getTime(timestamp) {
  var date = new Date(timestamp);
  var options = { hour: '2-digit', minute: '2-digit', hour12: true };
  return date.toLocaleTimeString(undefined, options);
}

//instead of using undefined checkers we can just check  for  undefined?
function getLength(obj) {
  if (obj !== undefined || null) {
    return Object.keys(obj).length
  }
}

function hasKey(obj, key) {
  if (obj !== undefined || null) {
    let keys = Object.keys(obj);
    if (keys.includes(key)) {
      return true
    } else {
      return false;
    }
  }
}

let useConsole = (state) => {
  useEffect(() => {
    console.log(state)
  }, [state]);
}

const App = () => (
  <AuthProvider>
    <ChatProvider>
      <Routes />
    </ChatProvider>
  </AuthProvider>
);

const Routes = () => (
  <Router>
    <Switch>
      <Route exact path="/" render={() => <SignIn />} />
    </Switch>
    <Media query="(max-width: 599px)">
      {matches =>
        matches ? (
          <Switch>
            <PrivateRoute
              exact
              path="/mobile"
              component={LoadConversations}
            />
            <PrivateRoute
              exact
              path="/mobile/conversations/:conversation_uid"
              component={SetConversation}
            />
            <PrivateRoute
              exact
              path="/mobile/find_contacts"
              component={ContactsList}
            />
            <Redirect from="/dashboard" to="/mobile" />
          </Switch>
        ) : (
            <Switch>
              <PrivateRoute
                path="/dashboard"
                component={UsersDashBoard}
              />
              <Redirect from="/mobile" to="/dashboard" />
            </Switch>
          )
      }
    </Media>
  </Router>
)

const PrivateRoute = ({ component: Component, ...rest }) => {
  const [authUser, initializing] = useAuthState();
  return (
    <Route
      {...rest}
      render={props =>
        !initializing ? (
          authUser.uid ? (
            <Component {...props} />
          ) : (
              <Redirect to={{
                pathname: "/",
                state: {
                  from: props.location,
                }
              }} />
            )
        ) : (
            <div className="spinner-loader"></div>
          )
      }
    />
  );
}

const SignIn = withRouter(({ location, history }) => {
  const [authUser, loading, setLoading] = useAuthState();

  const { from } = location.state || { from: { pathname: "/dashboard" } };

  const authUserByRedirect = () => firebase.auth().signInWithRedirect(google_auth_provider);
  const getRedirectResult = () => firebase.auth().getRedirectResult()

  useEffect(() => {
    if (!authUser.uid) {
      async function triggerFx() {
        console.log(authUser);
        try {
          await getRedirectResult();
        } catch (error) {
          setLoading(false)
          console.log(error);
        }
      }
      triggerFx();
    } else {
      history.push(from)
    }
  }, [authUser]);

  if (loading) return (
    <div className="home">
      <div className="just-for-mobile">
        <div className="spinner-loader"></div>
      </div>
    </div>)

  if (!loading) return (
    <div className="home">
      <div className="home-header">
        <h1> Just Chat </h1>
        <img src={pager_emoji_svg} alt="Pager Emoji" />
        <p>
          An exceedingly boring, real-time one-to-one, sample chat webapp
          built to help me learn google's firestore integration and the new react hooks API
          </p>
        <div className="is-centered">
          <button onClick={() => authUserByRedirect()}>Sign-in With Google</button>
        </div>
        <div className="link is-centered">
          <a href="https://github.com/ThobyV/just-chat-react-hooks-firestore">Github</a> | <a href="https://twitter.com/thoby_vic">Twitter</a>
        </div>
      </div>
    </div>
  )
});

const ReadReciepts = ({ message_read }) => {
  if (message_read) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="#1DA1F2" viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" /></svg>
  } else {
    return <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="#999999" viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" /></svg>
  }
}

const LoadConversations = ({ match }) => {
  const [authUser] = useAuthState();
  const [state, dispatch, loading] = useChatState();
  return (
    <LcComponent match={match}
      authUser={authUser}
      conversations={state.conversations}
      dispatch={dispatch}
      loading={loading}
    />
  )
}

const LcComponent = React.memo(function ({ match, authUser, conversations, dispatch, loading }) {
  const [selected, setSelected] = useState({});

  let findContactDetails = (arr, user_id) => arr.find(obj => obj.uid !== user_id)
  let setLastMessage = messages => messages[messages.length - 1];
  let setSelectedClass = (key_uid) => {
    setSelected({ key: key_uid })
  }
  const getLastMessage = (conversation) => {
    if (conversation.messages.length) {
      let { message, createdAt, sender_uid, read } = setLastMessage(conversation.messages);
      return {
        message_text: message,
        message_time: createdAt,
        sender_uid: sender_uid,
        read_state: read,
      }
    } else {
      //this handles a first time conversation where there is no last message
      let { most_recent_message_snapshot, timestamp, first_sender_uid } = conversation;
      return {
        message_text: most_recent_message_snapshot,
        message_time: timestamp,
        sender_uid: first_sender_uid,
        read_state: null,
      }
    }
  }

  return (
    <div className="c-container has-border-right">
      <div className="just-for-mobile">
        <div className="header-1">
          <div className="header-h2 has-border-right"><h2>Messages</h2></div>
          <div className="logout-h2 right"><h2 onClick={() => firebase.auth().signOut()}>Logout</h2></div>
        </div>

        {loading && <div className="spinner-loader"></div>}
        {!loading &&
          (<ul className="chats">
            {
              (conversations.length)
                ?
                conversations.map((_conversation) => {
                  let contactDetails = findContactDetails(_conversation.conversation_participants_details, authUser.uid);
                  let lastMessage = getLastMessage(_conversation)
                  //always reads as false when conversations are first loaded because no messages on client yet
                  let unreadMessages = () => _conversation.messages.filter(msg => msg.read === false && msg.sender_uid !== authUser.uid)
                  let MessageReadReciepts = () => lastMessage.sender_uid === authUser.uid ? <ReadReciepts message_read={lastMessage.read_state} /> : null

                  return (
                    <li
                      className={`clearfix space conv-li-style ${selected.key === _conversation.conversation_uid ? "li-selected" : ""}`}
                      key={_conversation.conversation_uid}
                      onClick={() => setSelectedClass(_conversation.conversation_uid)}>
                      <Link to={
                        {
                          pathname: `${match.path}/conversations/${_conversation.conversation_uid}`,
                          contact_details: contactDetails,
                        }
                      }>
                        <div className="img-left">
                          <div className={`rounded ${contactDetails.placeholderColor}`}>
                            <h2>{contactDetails.name.charAt(0)} </h2>
                          </div>
                        </div>

                        <div className="left chat-micro-details">

                          <div className="m-left block">
                            <b className="name space">{trimString(contactDetails.name, 15)}</b>
                          </div>

                          <div className="clear block">
                            <p className="left message space">{trimString(lastMessage.message_text, 25)}</p>
                            <div className="r read">
                              {
                                MessageReadReciepts()
                              }
                            </div>
                          </div>
                        </div>
                      </Link>
                      {
                        _conversation.first_message &&
                          _conversation.first_sender_uid !== authUser.uid &&
                          !_conversation.messages.length ? (<div className="label">new</div>)
                          : _conversation.unread_messages_count &&
                            !_conversation.messages.length ? (<div className="badge">{_conversation.unread_messages_count}</div>)
                            : unreadMessages().length ?
                              <div className="badge">{unreadMessages().length + _conversation.unread_messages_count}</div>
                              : null
                      }
                    </li>
                  )
                })
                :
                <div className="no-conversation">
                  <h1> Oops! </h1>
                  <img src={cat_emoji_svg} alt="Weary cat Emoji" />
                  <p> seems you have no conversations yet</p>
                  <div className="is-centered">
                    <Link to={`${match.path}/find_contacts`}>
                      <a>Start a conversation now</a>
                    </Link>
                  </div>
                </div>
            }
          </ul>)
        }
      </div>
      <Link to={`${match.path}/find_contacts`}>
        <div className="fab">
          <svg xmlns="http://www.w3.org/2000/svg" align="cennter" width="28" height="28" fill="#FFFFFF" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" /></svg>
        </div>
      </Link>
    </div>
  );
})

const SetConversation = ({ match, location }) => {
  const [authUser] = useAuthState();
  const [state, dispatch] = useChatState();
  const [loading, setLoading] = useState(false);
  const [cuidData, setCuidData] = useState('');
  const [newConversation, setNewConversation] = useState({});

  let cuid_identifier = match.params.conversation_uid;
  let contact_details = location.contact_details;

  let findContactDetails = (arr, user_id) => arr.find(obj => obj.uid !== user_id);
  let updateCuidData = (cuid, type) => setCuidData({ cuid, type })

  let setConversationAndMessages = async (conversationDoc) => {
    let convDocValue = (conversationDoc.docs) ? conversationDoc.docs[0] : conversationDoc;
    setLoading(true);
    let messagesList = await chatsCollection.doc(convDocValue.id)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(12)
      .get();

    if (messagesList.empty) {
      console.log("no messages")
    }
    //single conversation
    let conversation = [];
    conversation.push({
      conversation_uid: convDocValue.id,
      conversation_participants_uid: convDocValue.data().conversation_participants_uid,
      conversation_participants_details: convDocValue.data().conversation_participants_details,
      messages: messagesList.docs.map(doc => ({ ...doc.data(), message_id: doc.id })).reverse(),
      timestamp: convDocValue.data().timestamp,
      most_recent_message_snapshot: convDocValue.data().most_recent_message_snapshot,      
      unread_messages_count: 0,            
    });

    if (conversation.length) {
      dispatch({
        type: "UPDATE_CONVERSATIONS",
        payload: conversation
      });
      updateCuidData(convDocValue.id, null)
      setLoading(false)
    }
  }

  const checkFirestoreForConversationByUID = async (cuid) => {
    try {
      const conversationDoc = await chatsCollection.doc(cuid).get();
      if (conversationDoc.exists) {
        const userParticipated = conversationDoc.data()
          .conversation_participants_uid
          .includes(authUser.uid);
        if (userParticipated) {
          setConversationAndMessages(conversationDoc);
        } else {
          console.log("an error occured, you cant view this conversation");
        }
      } else {
        console.log("this conversation does not exist");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const checkFirestoreForConversationByContact = async (contact_uid) => {
    try {
      setLoading(true);
      const conversationDoc = await chatsCollection
        .where(authUser.uid, "==", true)
        .where(contact_details.uid, "==", true)
        .get();
      conversationDoc.docs.map(doc => console.log(doc.data()))
      if (conversationDoc.empty) {
        createNewConversationOnClient();
        setLoading(false)
        console.log('sorry your conversation does not exsit by contact')
      }
      if (!conversationDoc.empty) {
        setConversationAndMessages(conversationDoc)
      }
    } catch (error) {
      console.log(error)
    }
  }

  const loadMessagesByConversationUID = async (cuid) => {
    try {
      setLoading(true)
      let messagesBucket = [];
      const messages = await chatsCollection.doc(`${cuid}`)
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(12)
        .get();

      if (messages.empty) {
        console.log("no messages");
      } else {
        messages.docs.forEach((msg, index, bucket) => {
          messagesBucket.push({
            message_id: msg.id,
            ...msg.data(),
          });
          if (index === bucket.length - 1) {
            dispatch({ type: "SET_MESSAGE", payload: messagesBucket.reverse() });
            setLoading(false)
          }
        })
      }
    } catch (error) {
      console.log(error);
    }
  };

  const createNewConversationOnClient = () => {
    let cuid = uuidv1()
    let conversation_data = {
      conversation_uid: cuid,
      conversation_participants_uid: [authUser.uid, contact_details.uid],
      conversation_participants_details: [
        {
          "name": authUser.displayName,
          "uid": authUser.uid,
          "placeholderColor": authUser.placeholderColor,
        },
        {
          "name": contact_details.name,
          "uid": contact_details.uid,
          "placeholderColor": contact_details.placeholderColor,
        },
      ],
      [authUser.uid]: true,
      [contact_details.uid]: true,
      TYPING_STATUS: {
        [authUser.uid]: false,
        [contact_details.uid]: false
      },
      unread_messages_count: 0,      
    }
    setNewConversation(conversation_data);
    updateCuidData(cuid, 'NEW_CONVERSATION');
  }

  //check for convo by cuid or contact linking (user uids in an array) from local state or server
  useEffect(() => {
    if (state.initialized) {
      if (cuid_identifier !== "contactbased") {
        let conv = state.conversations.find(val => val.conversation_uid === cuid_identifier);
        if (getLength(conv)) {
          if (!conv.messages.length) {
            loadMessagesByConversationUID(cuid_identifier);
          }
          updateCuidData(conv.conversation_uid, null);
        } else {
          checkFirestoreForConversationByUID(cuid_identifier);
        }
      }

      if (cuid_identifier === "contactbased") {
        let conv = state.conversations.filter(
          val =>
            val.conversation_participants_uid.includes(authUser.uid) &&
            val.conversation_participants_uid.includes(contact_details.uid)
        )[0];
        if (getLength(conv)) {
          if (!conv.messages.length) {
            loadMessagesByConversationUID(cuid_identifier);
          }
          updateCuidData(conv.conversation_uid, null);
        } else {
          checkFirestoreForConversationByContact(contact_details.uid);
        }
      }
    }

  }, [state.initialized, cuid_identifier]);

  return loading ?
    <div className="just-for-mobile">
      <div className="spinner-loader"></div>
    </div>
    :
    <ChatComponent
      cuid_data={cuidData}
      contact_details={contact_details}
      auth_user={authUser}
      findContactDetails={findContactDetails}
      new_conversation={newConversation}
    />
}

const UserMessage = ({ chat }) => {
  return (
    <li
      className="me-bubble"
      key={chat.createdAt}>
      <div className="me-msg">
        {chat.date && <div className="date-marker">{chat.date}</div>}
        <p> {chat.message}
          <div className="drop-under-bubble">
            {chat.read ?
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="#1DA1F2" viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" /></svg>
              :
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="#999999" viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" /></svg>
            }
            {chat.time}
          </div>
        </p>
      </div>
    </li>
  );
}

const ContactMessage = ({ chat, contact_details }) => {
  return (
    <li
      className="them-bubble"
      key={chat.createdAt}>
      <div className="them-msg">
        {chat.date && <div className="date-marker">{chat.date}</div>}
        <p>
          {chat.message}
          <div className="drop-under-bubble">
            {chat.time}
          </div>
        </p>
      </div>
    </li>
  );
}

const ChatComponent = withRouter(function ({ history, cuid_data, contact_details, auth_user, findContactDetails, new_conversation }) {
  const [state, dispatch] = useChatState();
  const [paginate, setPaginate] = useState(false);

  let ulEl = useRef(null);
  let scrollBtnEl = useRef(null);
  let loadingEl = useRef(null);
  let loadMoreBool = useRef({ loading: false, canLoad: false, paginate: false });
  let newMsgEl = useRef(false);
  let btnOn = useRef(false);

  let showUnreadBtn = (unread_count) => {
    newMsgEl.current.textContent = `${unread_count}`;
    newMsgEl.current.style.visibility = 'visible';
  }

  let hideUnreadBtn = () => {
    newMsgEl.current.textContent = ``;
    newMsgEl.current.style.visibility = 'hidden';
  }

  let toggleScrollBtnOff = () => {
    scrollBtnEl.current.style.visibility = "hidden";
  }

  let toggleScrollBtnOn = (unread_count) => {
    scrollBtnEl.current.style.visibility = "visible";
  }

  let scrollUlToBottom = () => {
    ulEl.current.scrollTop = ulEl.current.scrollHeight - (ulEl.current.clientHeight);
  }

  let scrolledToTop = () => {
    let ulElmnt = ulEl.current;
    return (ulElmnt.scrollTop === 0);
  }

  let scrolledToBottom = () => {
    let ulElmnt = ulEl.current;
    let ulElScrolledToBottomVal = ulElmnt.scrollHeight - ulElmnt.clientHeight;
    return ulElmnt.scrollTop === ulElScrolledToBottomVal;
  }

  let scrollAction = () => {
    hideUnreadBtn();
    toggleScrollBtnOff();
    scrollUlToBottom();
  }

  let showloadingEl = () => { loadingEl.current.style.visibility = "visible"; }
  let hideloadingEl = () => { loadingEl.current.style.visibility = "hidden" }

  let triggerLoadMoreEffect = () => { callSetPaginate(); };

  let canNowLoad = () => {
    loadMoreBool.current = { ...loadMoreBool.current, canLoad: true };
  }

  let setLoadingToTrue = () => {
    loadMoreBool.current = { ...loadMoreBool.current, loading: true };
  }

  let setLoadingToFalse = () => {
    loadMoreBool.current = { ...loadMoreBool.current, loading: false };
  }

  let callSetPaginate = () => { setPaginate(prevBool => !prevBool) };

  let onScrollhandler = () => {
    if (scrolledToBottom() && btnOn.current) {
      toggleScrollBtnOff();
      hideUnreadBtn();
      btnOn.current = false;
      console.log('fired start');
    }
    if (!scrolledToBottom() && !btnOn.current) {
      toggleScrollBtnOn();
      btnOn.current = true;
      console.log('fired end');
    }
    if (scrolledToTop() && !loadMoreBool.current.loading) {
      showloadingEl();
      canNowLoad();
      triggerLoadMoreEffect();
    }
  }

  const conversation = state.conversations.find(val => val.conversation_uid === cuid_data.cuid);
  const messages = (hasKey(conversation, "messages")) ? conversation.messages : null
  const conv_typing_status = state.conversations_by_typingState.find((state) => {
    return state.hasOwnProperty(cuid_data.cuid)
  })

  const getScrollByEnteredMessageVal = () => {
    const last_message = messages[messages.length - 1] || { sender_uid: null };
    if (last_message.sender_uid === auth_user.uid) {
      return last_message.createdAt;
    }
  }

  const scrollDownOnEnterOrClick = (hasKey(conversation, "messages")) ? getScrollByEnteredMessageVal() : null;

  const MapChatsAndMarkers = (contact_details) => messages.map((data, index, array) => {
    if (index === 0) {
      let chat = { ...data, date: getDate(data.createdAt), time: getTime(data.createdAt), }
      if (chat.sender_uid === auth_user.uid) {
        return <UserMessage chat={chat} />
      }
      return <ContactMessage chat={chat} contact_details={contact_details} />
    }
    if (index !== 0) {
      let $date = getDate(data.createdAt);
      let equal_dates = getDate(data.createdAt) === getDate(array[index - 1].createdAt);//find closest obj with different time/date
      let chat;

      if (!equal_dates) {
        chat = { ...data, date: $date, time: getTime(data.createdAt) }
      } else {
        chat = { ...data, date: null, time: getTime(data.createdAt) }
      }

      if (chat.sender_uid === auth_user.uid) {
        return <UserMessage chat={chat} />
      }
      return <ContactMessage chat={chat} contact_details={contact_details} />
    }
  })

  useEffect(() => {
    hideloadingEl();
    scrollAction();
  }, [scrollDownOnEnterOrClick])

  useEffect(() => {
    async function loadOlderMessages() {
      let canLoad = loadMoreBool.current.canLoad
      if (canLoad) {
        try {
          setLoadingToTrue();
          const old_msgs = await chatsCollection
            .doc(cuid_data.cuid)
            .collection("messages")
            .orderBy("createdAt", "desc")
            .startAfter(messages[0].createdAt)
            .limit(3)
            .get()

          if (!old_msgs.empty) {
            hideloadingEl();
            setLoadingToFalse();
            let reversedMessages = old_msgs.docs.map(doc => doc.data())
            dispatch({ type: "SET_PAGINATED_MESSAGES", payload: reversedMessages.reverse() })
          }
          if (old_msgs.empty) {
            setLoadingToFalse()
            console.log('error loading messages')
          }
        } catch (error) {
          console.log(error)
        }
      }
    }
    loadOlderMessages()
  }, [paginate])


  useEffect(() => {
    if (hasKey(conversation, "messages")) {
      if (conversation.messages.length) {
        dispatch({ type: "CLEAR_STATIC_UNREAD_COUNT", payload: conversation.conversation_uid });
        let unread = messages.filter(msg => msg.read === false && msg.sender_uid !== auth_user.uid);
        if (unread.length) {
          if (!scrolledToBottom()) {
            showUnreadBtn(unread.length);
          }

          async function setMessageReadReciepts() {
            unread.forEach(async ({ message_id, channel_id, message }) => {
              try {
                console.log('fired unread setter')
                await chatsCollection
                  .doc(channel_id)
                  .collection("messages")
                  .doc(message_id)
                  .update({ read: true })
              } catch (error) {
                console.log(error)
              }
            })
          }
          setMessageReadReciepts()

        }
      }
    }
  }, [messages]);

  return (
    <div className="c-container">
      <div className="just-for-mobile">
        <div className="header-2" onClick={() => history.goBack()}>
          <div className="header-arrow">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#FFF" viewBox="0 0 18 18"><path d="M15 8.25H5.87l4.19-4.19L9 3 3 9l6 6 1.06-1.06-4.19-4.19H15v-1.5z" /></svg>
          </div>
          {contact_details ?
            <div className="fix-margin">
              <p className={`header-char ${contact_details.placeholderColor}`}>{contact_details.name.charAt(0)} </p>
              <div className="header-h3"><h2>{contact_details.name}</h2></div>
            </div>
            : getLength(conversation) &&
            <div className="fix-margin">
              <p className={`header-char ${auth_user.placeholderColor}`}>{findContactDetails(conversation.conversation_participants_details, auth_user.uid).name.charAt(0)} </p>
              <div className="header-h3"><h2>{findContactDetails(conversation.conversation_participants_details, auth_user.uid).name}</h2></div>
            </div>
          }
        </div>

        <ul ref={ulEl} onScroll={onScrollhandler} className="bubbledad">

          {<div ref={loadingEl} className="spinner-loader-old-chats"></div>}
          {
            hasKey(conversation, "first_message") &&
            (conversation.first_sender_uid === auth_user.uid) &&
            <li className="me-bubble" key={'first_message'}>
              <div className="me-msg">
                <p>{conversation.first_message}</p>
              </div>
            </li>
          }

          {
            (getLength(conversation))
              ?
              (conversation.messages.length) ?
                MapChatsAndMarkers(contact_details)
                :
                <b>{!conversation.first_message && "No messages"}</b>
              :
              <div className="no-msgs">
                <h1> Uh Oh..! No Messages </h1>
                <img src={message_emoji_svg} alt="Weary cat Emoji" />
                <p>Be the first to text {hasKey(contact_details, "name") && contact_details.name}</p>
              </div>
          }

          {
            hasKey(contact_details, "uid") &&
            hasKey(conv_typing_status, cuid_data.cuid) &&
            conv_typing_status[cuid_data.cuid].TYPING_STATUS[contact_details.uid] &&
            <li className="them-bubble" key={'is_typing'}>
              <div className="them-msg"><i>Is typing....</i></div>
            </li>
          }
          {<div ref={newMsgEl} className="unread-msg-btn"></div>}
          {<button ref={scrollBtnEl} className="scroll-btn" onClick={scrollAction}><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#000" viewBox="0 0 48 48"><path d="M7.41 7.84L12 12.42l4.59-4.58L18 9.25l-6 6-6-6z" /></svg></button>}
        </ul>
        <Input cuid_data={cuid_data.cuid ? cuid_data : ''}
          auth_user={auth_user} new_conversation={new_conversation} />
      </div>
    </div>
  )
});

function Input({ cuid_data, auth_user, new_conversation }) {
  const [value, setValue] = useState('');
  const [sendVal, setSendVal] = useState('');
  const [elHeightData, setElHeightData] = useState({});
  const [disabled, setDisabled] = useState(false);
  const [postedToFireStore, setPostedToFirestore] = useState(false);

  let inputEl = useRef(null);
  let { cuid, type } = cuid_data;
  let counter = 0;

  let autoResizeInput = () => {
    inputEl.current.style.height = elHeightData.contentHeight;
    inputEl.current.style.height = (inputEl.current.scrollHeight - elHeightData.paddingY) + "px";
  }

  let callSetSendVal = () => {
    setSendVal(inputEl.current.value)
    inputEl.current.value = ''
  }

  let handleKeyDown = event => {
    if (event.key === "Enter") {
      event.preventDefault();
      callSetSendVal();
    }
  };

  let handleTextarea = () => {
    autoResizeInput();
    setValue(inputEl.current.value);
  }

  let handleClick = () => {
    callSetSendVal()
  }

  const postMessage = async (message) => {
    try {
      inputEl.current.style.height = (elHeightData.contentHeight) + "px";
      setDisabled(true);
      counter++;

      let batch = firestoreDb().batch();
      let conversationsRef = chatsCollection.doc(cuid);
      let messagesRef = chatsCollection.doc(cuid).collection("messages").doc();

      batch.set(messagesRef, {
        message: message,
        sender_name: auth_user.displayName,
        sender_uid: auth_user.uid,
        channel_id: cuid,
        createdAt: Date.now(),
        read: false,
      })
      if (type === "NEW_CONVERSATION") {
        console.log('new convoo')
        batch.set(conversationsRef, {
          ...new_conversation,
          createdAt: Date.now(),
          most_recent_message_snapshot: message,
          first_message: message,
          first_sender_uid: auth_user.uid,
        })
        //reset conversation type
        type = null;
      }
      else {
        batch.update(conversationsRef, {
          first_message: null,
          most_recent_message_snapshot: message,
          timestamp: Date.now(),
          [`TYPING_STATUS.${auth_user.uid}`]: false,
        })
      }
      await batch.commit();
      setDisabled(false);
    } catch (error) {
      console.log(error)
    }
  }

  useEffect(() => {
    let styleProps = getComputedStyle(inputEl.current);
    let paddingY = parseFloat(styleProps.paddingTop) + parseFloat(styleProps.paddingBottom);
    let contentHeight = inputEl.current.scrollHeight - paddingY;
    setElHeightData({ contentHeight, paddingY });
  }, []);


  useEffect(() => {
    async function setTypingStatus() {
      let typingStarted = value.length === 1 && !postedToFireStore;
      let typingCleared = value.length === 0 && postedToFireStore;

      if (typingStarted) {
        try {
          console.log('fired typing status func')
          setPostedToFirestore(true);
          await chatsCollection
            .doc(cuid)
            .update({
              [`TYPING_STATUS.${auth_user.uid}`]: true,
            })
        } catch (error) {
          console.log(error)
        }
      }

      if (typingCleared) {
        try {
          setPostedToFirestore(false);
          await chatsCollection
            .doc(cuid)
            .update({
              [`TYPING_STATUS.${auth_user.uid}`]: false,
            })
        } catch (error) {
          console.log(error)
        }
      }

    }
    setTypingStatus()
  }, [value])

  useEffect(() => {
    if (value) {
      postMessage(value)
    }
  }, [sendVal]);

  return (
    <div className="input-container">
      <textarea ref={inputEl} rows="1" type="text" placeholder="Message" onChange={handleTextarea} onKeyDown={handleKeyDown} />
      <button className="send-msg-btn" onClick={handleClick} disabled={disabled}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1DA1F2" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg></button>
    </div>
  );
}

const ContactsList = ({ history, match }) => {
  const [authUser] = useAuthState();
  const [loading, setLoading] = useState(true);
  const [contactsList, setContactsList] = useState([])

  useEffect(() => {
    async function getContacts() {
      try {
        const querySnapShotResult = await usersCollection.get();
        if (querySnapShotResult.empty) {
          console.log("oops no contacts");
        } else {
          const allContactsList = querySnapShotResult.docs
            .map(doc => doc.data())
            .filter(doc => doc.uid !== authUser.uid);
          setLoading(false)
          setContactsList(allContactsList);
        }
      } catch (error) {
        console.log(error);
      }
    }
    getContacts();
  }, []);

  useConsole(contactsList);

  return (
    <div className="c-container">
      <div className="just-for-mobile">
        <div className="header-2" onClick={() => history.goBack()}>
          <div className="header-arrow">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#FFF" viewBox="0 0 18 18"><path d="M15 8.25H5.87l4.19-4.19L9 3 3 9l6 6 1.06-1.06-4.19-4.19H15v-1.5z" /></svg>
          </div>
          <div className="header-h2"><h2>Contacts</h2></div>
        </div>
        {
          loading ? <div className="spinner-loader"></div>
            :
            contactsList.length ?
              <ul className="contacts">
                {
                  contactsList.map(contact =>
                    <li key={contact.uid}>
                      <Link to={
                        {
                          pathname: `conversations/contactbased`,
                          contact_details: {
                            name: contact.name || contact.displayName,
                            uid: contact.uid,
                            placeholderColor: contact.placeholderColor,
                          },
                        }
                      }>
                        <div className="img-left">
                          <div className={`rounded ${contact.placeholderColor}`}>
                            <h2>{contact.name || contact.displayName.charAt(0)} </h2>
                          </div>
                        </div>
                        <b className="name space">{contact.name || contact.displayName}</b>
                      </Link>
                    </li>
                  )
                }
              </ul>
              :
              <b>You have no contacts</b>
        }
      </div>
    </div>
  )
}

const UsersDashBoard = ({ match, location }) =>
  (
    <div className="container">
      <div className="column-is-4">
        <LoadConversations match={match} />
      </div>
      <div className="column-is-6">

        <PrivateRoute
          path={`${match.path}/conversations/:conversation_uid`}
          key={location.pathname}
          component={SetConversation}
        />
        <PrivateRoute
          exact
          path={`${match.path}/find_contacts`}
          component={ContactsList} />
      </div>
    </div>
  )

export default App;