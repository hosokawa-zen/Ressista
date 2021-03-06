import {
	put, select, takeLatest,
} from 'redux-saga/effects';

import 'moment/min/locales';

import * as types from '../Actions/actionsTypes';
import {
	appStart, ROOT_INSIDE, ROOT_OUTSIDE, ROOT_SET_NAME,
} from '../Actions/app';
import FirebaseStore from '../Lib/fireStore';
import {setCategories, setUpdateForums} from '../Actions/category';
import {setCategory, setRelationShipUpdateForums} from '../Actions/relationship';
import {setUnreadMessages, setRooms} from '../Actions/message';
import {setFcmToken} from "../Lib/notification";
import Navigation from "../Lib/Navigation";
import AsyncStorage from "@react-native-community/async-storage";

const handleLoginSuccess = function* handleLoginSuccess({ data }) {
	const { uid, profile } = data;

	if(!profile.displayName){
		yield put(appStart({root: ROOT_SET_NAME}));
		return;
	}

	// Categories
	let categories = yield FirebaseStore.getCategories();
	let updateForumCount = 0;
	categories.forEach(category => {
		let updateForums = category.forums.filter(forum => forum.updatedAt && forum.updatedAt > profile.lastVisit);
		updateForumCount += updateForums.length;
	})
	yield put(setUpdateForums(updateForumCount));
	yield put(setCategories(categories));

	// RelationShips
	let relationship = yield FirebaseStore.getRelationshipCategory();
	let updateForums = relationship.forums.filter(forum => forum.updatedAt && forum.updatedAt > (profile.lastVisitRelationShip??profile.lastVisit));
	let updateRelationShipForumCount = updateForums.length;
	yield put(setRelationShipUpdateForums(updateRelationShipForumCount));
	yield put(setCategory(relationship));

	// Chat Rooms
	let rooms =  yield FirebaseStore.getUserRooms(uid);
	let unread = 0;
	rooms.forEach(room => unread += room.unread);
	yield put(setUnreadMessages(unread));
	yield put(setRooms(rooms));

	yield setFcmToken(uid);

	yield put(appStart({root : ROOT_INSIDE}));

	let notification = yield AsyncStorage.getItem('notification');
	if(notification){
		const notificationData = JSON.parse(notification);
		const {  action, userId, toId } = notificationData;

		switch (action){
			case 'message':
				if(userId && toId){
					const room = yield FirebaseStore.getRoom(userId, toId);
					if(room){
						setTimeout(() => Navigation.navigate("InsideStack", { screen: 'UserChat', params: { room: room }}, 2000));
					}
				}
				break;
		}
		yield AsyncStorage.removeItem('notification');
	}
};

const handleLogout = function* handleLogout({}) {
	yield AsyncStorage.removeItem('storage_remember')
	yield AsyncStorage.removeItem('provider')
	yield AsyncStorage.removeItem('token')
	yield put(appStart({root : ROOT_OUTSIDE}));
};

const handleUserUpdateLastVisit = function* handleUserSet({}) {
	// update lastVisit
	yield put(setUpdateForums(0));
}

const handleUserUpdateLastRelationShipVisit = function * handleUserUpdateLastRelationShipVisit({}){
	// update lastVisitRelationShip
	yield put(setRelationShipUpdateForums(0));
}

const root = function* root() {
	yield takeLatest(types.LOGOUT, handleLogout);
	yield takeLatest(types.LOGIN.SUCCESS, handleLoginSuccess);
	yield takeLatest(types.USER.UPDATE_LAST_VISIT, handleUserUpdateLastVisit);
	yield takeLatest(types.USER.UPDATE_LAST_RELATIONSHIP_VISIT, handleUserUpdateLastRelationShipVisit);
};
export default root;
