angular.module('starter.controllers', ['starter.services','ngCordova'])

.controller('AppCtrl', function($scope, $ionicModal, $timeout, DataService, $ionicLoading, $ionicPopup, $location, $state, $ionicPlatform, Pubnub, $cordovaBarcodeScanner, $cordovaDevice) {

	// With the new view caching in Ionic, Controllers are only called
	// when they are recreated or on app start, instead of every page change.
	// To listen for when this page is active (for example, to refresh data),
	// listen for the $ionicView.enter event:
	$scope.$on('$ionicView.enter', function(e) {
		//$scope.SubscribeToChannels();
	});
	
	/**
	 * Set Session info
	 */
	$scope.sessioninfo = {session : 1};
	$scope.table = {};
	
	$scope.bill = {
			mytotal : 0.00,
			total   : 0.00,
			others  : []
	}
	
	$scope.SetGlobalVariables = function(k,v) {
		$scope.sessioninfo[k] = v;
	}
	
	/**
	 * PUBNUB
	 */
	
	Pubnub.init({
    	publish_key   : 'pub-c-e2cbdb4d-2f09-48e0-a3d2-b4fb18be7552',
        subscribe_key : 'sub-c-f24903dc-e1e8-11e5-b07b-02ee2ddab7fe'
	});
    
    $scope.chrestaurant = 'theeasymenu_1';//Restaurant Channel
	$scope.chbranch = $scope.chrestaurant  + '.1';//Branch Channel
	$scope.chtable = $scope.chbranch + '.1';//Table Channel
	$scope.chuser = $scope.chtable + '.' //Table Channel
	
	$scope.$on(Pubnub.getMessageEventNameFor($scope.chtable), function (ngEvent, message, envelope, channel) {
	    $scope.$apply(function () {
	    	$scope.handlePubNumbMessage($scope.chtable , message);
	    });
	});
	
	$scope.handlePubNumbMessage = function(channel , msg) {
		console.log(channel);
		//User specific function
		if (channel == $scope.chuser) {
			obj = JSON.parse(msg);
			if (obj.action == 'order') {

				//User has paid for you!
				if (obj.actionid == 1) {
					if (parseInt(obj.to_user_id) == parseInt($scope.user.id)) {
						$scope.onbehalfof = JSON.parse(obj.from_user);
						
						tableDetails = JSON.parse(DataService.getlocal('table'));
						tmpUser = JSON.parse(obj.from_user);
						angular.forEach(tableDetails.data.user , function(v,k) {
							
							if (parseInt(tmpUser.id) == parseInt(v.id)) {
								$scope.onbehalfof = v;
							}
						});
						
						$scope.paymentMadeOnBehalfModal.show();
						
						$scope.GetOrder();
						$scope.GetTable();
					}
				}
			}
		}
		
		//Table specific function
		if (channel == $scope.chtable) {
			obj = JSON.parse(msg);
			
			if (obj.action == "tbl") {
				
				//request to join table
				if (obj.actionid == 1) {
					if (parseInt(obj.from_user.id) != parseInt($scope.user.id)) {
						$scope.fetchTableRequests();
					}
					
				}
				
				//accepted request
				if (obj.actionid == 2) {
					$scope.fetchTableRequests();
					
					//If this is for the actioned user...
					if (parseInt(obj.to_user_id) == parseInt($scope.user.id)) {
						tmpData = JSON.parse(DataService.getlocal('activesession'));
						tmpData.data.data[0].my_session_status = 1;
						$scope.SetGlobalVariables('session',tmpData.data.data[0].my_session_status);
						DataService.setlocal('activesession',JSON.stringify(tmpData));
						//$scope.$broadcast("Checkin", {});
						
						$scope.showAlert('Request Accepted!' , 'You have been accepted to the table');
						
						$scope.GetOrder();
					} else {
						$scope.GetOrder();
						$scope.GetTable();
					}
				}
				
				//rejected request
				if (obj.actionid == 3) {
					$scope.fetchTableRequests();
					
					$scope.showAlert('Request Rejected!' , 'Your request to join the table has been rejected');
				}
				
				//cancelled request
				if (obj.actionid == 4) {
					$scope.fetchTableRequests();
				}

				//UPDATE table
				if (obj.actionid == 5) {
					$scope.GetTable();
				}
				
			}
			
		}
	}
	
	$scope.mockdata = function() {
		var pubnubmessage = {
				from 			: $scope.user,
				to_user_id   	: 1,
				action       	: 'tbl',
				actionid     	: 2,
				message      	: ''
			};
		
		$scope.handlePubNumbMessage($scope.chtable , JSON.stringify($scope.pubnubmessage));
	}
    
    $scope.SubscribeToChannels = function() {
    	/*Pubnub.subscribe({
    		channel  : $scope.chrestaurant,
    		triggerEvents: ['callback', 'presence'],
    	});
    	
    	Pubnub.subscribe({
    		channel  : $scope.chbranch,
    		triggerEvents: ['callback', 'presence'],
    	});*/
    	
    	Pubnub.subscribe({
    		channel  : $scope.chtable,
    		triggerEvents: ['callback', 'presence'],
    	});
    	
    	$scope.chuser = $scope.chtable + '.' + $scope.user.id //Table Channel
    	
    	Pubnub.subscribe({
    		channel  : $scope.chuser,
    		triggerEvents: ['callback', 'presence'],
    	});
    	
    	$scope.$on(Pubnub.getMessageEventNameFor($scope.chuser), function (ngEvent, message, envelope, channel) {
    	    $scope.$apply(function () {
    	    	$scope.handlePubNumbMessage($scope.chuser , message);
    	    });
    	});
	};
	
	$scope.sendMessage = function(channel , from , to , action , actionid , msg) {
		
		//Just clear this for now
		//from.image = '';
		
		
		var pubnubmessage = {
			from_user 	: from,
			to_user_id  : parseInt(to),
			action      : action,			
			actionid    : parseInt(actionid),			
			message     : msg
		};
		
		console.log(channel , pubnubmessage);

		Pubnub.publish({channel:channel , message: JSON.stringify(pubnubmessage)});
		
	};
    
    /**
     * END PUBNUB
     */

	/** User Details **/
	$scope.user = {
		id				: 0,
		email 			: '',
		password 		: '',
	};
	
	$scope.requests = [];
	
	/**
	 * Modals Start
	 */
	// Create the login modal that we will use later
	$ionicModal.fromTemplateUrl('templates/login.html', {
		scope: $scope
	}).then(function(modal) {
		$scope.loginModal = modal;
	});
	
	$ionicModal.fromTemplateUrl('templates/requests.html', {
		scope: $scope
	}).then(function(modal) {
		$scope.requestsModals = modal;
	});
	
	$ionicModal.fromTemplateUrl('templates/payment.html', {
		scope: $scope
	}).then(function(modal) {
		$scope.paymentModal = modal;
	});
	
	$ionicModal.fromTemplateUrl('templates/paymentMadeOnBehalf.html', {
		scope: $scope
	}).then(function(modal) {
		$scope.paymentMadeOnBehalfModal = modal;
	});

	// Triggered in the login modal to close it
	$scope.closeLogin = function() {
		$scope.loginModal.hide();
	};
	
	$scope.closePaymentMadeOnBehalfModal = function() {
		$scope.paymentMadeOnBehalfModal.hide();
	}
	
	$scope.closeRequests = function() {
		$scope.requestsModals.hide();
	}

	// Open the login modal
	$scope.login = function() {
		$scope.loginModal.show();
	};
	
	$scope.$watch('myorder',function() {
		$scope.bill.mytotal = $scope.myorder.totals.amount;
		$scope.AddToTotal();
	});
	
	$scope.$watch('table',function() {
		var iCounter = 0;
		$scope.row = {};
		$scope.bill.others = [];
		angular.forEach($scope.table.user,function(v,k) {
			if (v.id != $scope.user.id) {
				$scope.row[iCounter] = v;
				//if (iCounter == 1) {
					$scope.bill.others.push($scope.row);
					iCounter = 0;
					$scope.row = {};
				//}
				iCounter++;
			}
		});
	});
	
	$scope.showPaymentModal = function() {
		$scope.paymentModal.show();
	};
	
	$scope.closePaymentModal = function() {
		$scope.paymentModal.hide();
	};
	
	/**
	 * Modals End
	 */
	
	$scope.logout = function() {
		DataService.clearCache();
		$scope.reset();
		$state.go('app.dashboard');
	}
	
	$scope.showAlert = function(title , template) {
		var alertPopup = $ionicPopup.alert({
		     title: title,
		     template: template
		});

		alertPopup.then(function(res) {
		});
	};
	
	$scope.ViewRequests = function() {
		$scope.requestsModals.show();
	}
  
	/*********************************************************************************************
	 * Login Data Calls
	 */
	
  	$scope.$on('login-success',function(event,data) {
  		$scope.user = data.data.data.user;
  		$scope.GetActiveSessions();
  		
  		$ionicLoading.hide();
  		$scope.closeLogin();
  	});
  	
  	$scope.$on('login-failed',function(event,data) {
		$ionicLoading.hide();
	});

	// Perform the login action when the user submits the login form
	$scope.doLogin = function() {
		$ionicLoading.show({ template: 'Please wait...' });
		DataService.get(
			  'user',
			  endpoint + 'login/login',
			  { loginemail : $scope.user.email, loginpassword : $scope.user.password },
			  'login-success',
			  'login-failed',
			  true
		);
	};
	
	/**
	 * End Login Data Calls
	 *********************************************************************************************/
	
	
	
	/*********************************************************************************************
	 * Fetch Table Requests
	 */
	
	var push = null;
  
  	$scope.$on('fetch-table-requests-success',function(event,data) {
  		$scope.requests = data.data.data;
  	});
  	
  	$scope.$on('fetch-table-requests-failed',function(event,data) {
	});

	// Perform the login action when the user submits the login form
	$scope.fetchTableRequests = function() {
		DataService.get(
			  'table_requests',
			  endpoint + 'session/requests',
			  { session : 1 },
			  'fetch-table-requests-success',
			  'fetch-table-requests-failed',
			  true
		);
	};
	
	/**
	 * End Fetch Table Requests
	 *********************************************************************************************/
	
	/*********************************************************************************************
	 * Fetch Table Requests
	 */
	
	var push = null;
  
  	$scope.$on('table_action-success',function(event,data) {
  		$scope.sendMessage($scope.chtable , $scope.user , data.data.data.userid , 'tbl' , data.data.data.action , '');
  	});
  	
  	$scope.$on('table_action-failed',function(event,data) {
	});

  	$scope.ActionRequest = function(actionid , userid) {
  		DataService.get(
  			  'table_action',
  			  endpoint + 'session/action',
  			  { session : 1, action : actionid , userid : userid },
  			  'table_action-success',
  			  'table_action-failed',
  			  true
  		);
	}
	
	
	/**
	 * End Fetch Table Requests
	 *********************************************************************************************/
	
	$scope.GoToSession = function(session) {
		DataService.setlocal('activesession',JSON.stringify(session));
		$state.go('app.session');
	};
	
	$scope.reset = function() {
		$scope.user = {
				id				: 0,
				email 			: '',
				password 		: '',
			};
		
		$scope.requests = [];
		$scope.sessions = {};
	};
  
	
	$scope.myorder = {
		totals : {}
	};
	$scope.session = {};
	
	$scope.view = 0;

	$scope.menu = {};
	$scope.menuitem = {};
	
	$scope.orderitem = {}; 				//this is the variable that gets pushed through to the order
	
	/*********************************************************************************************
	 * Get Menu
	 */
  
  	$scope.$on('get-menu-success',function(event,data) {
  		$scope.menu = data.data.data;
  		$ionicLoading.hide();
  		$scope.$broadcast('scroll.refreshComplete');
  	});

	$scope.$on('get-menu-failed',function(event,data) {
		$ionicLoading.hide();
	});

	// Perform the login action when the user submits the login form
	$scope.GetMenu = function() {
		
		$ionicLoading.show({ template: 'Loading Sessions...' });
		
		DataService.get(
			  'menu',
			  endpoint + 'menu/list',
			  { restaurant_branch_id : 1 },
			  'get-menu-success',
			  'set-menu-failed',
			  true
		);
		
	};
	
	/**
	 * End Get Session
	 *********************************************************************************************/
	
	/*********************************************************************************************
	 * Get My Order
	 */
  
  	$scope.$on('get-my-order-success',function(event,data) {
  		$scope.myorder = data.data.data;
  	});

	$scope.$on('get-my-order-failed',function(event,data) {
		$scope.showAlert('Shit!' , 'There was a problem loading your order, please try again...');
	});

	$scope.GetOrder = function() {
		DataService.get(
			  'order',
			  endpoint + 'order/get',
			  { session_id : 1 , user_id : $scope.user.id },
			  'get-my-order-success',
			  'set-my-order-failed',
			  true
		);
		
	};
	
	/**
	 * End Get Session
	 *********************************************************************************************/

	$scope.OpenMenuItem = function(item) {
		$scope.menuitem = item;
		$scope.orderitem = {};
		//alert(id);
		$scope.menumodal.show();
	}
	
	// Create the login modal that we will use later
	$ionicModal.fromTemplateUrl('templates/menuitem.html', {
		scope: $scope
	}).then(function(modal) {
		$scope.menumodal = modal;
	});

	// Triggered in the login modal to close it
	$scope.closeMenu = function() {
		$scope.menumodal.hide();
	};
	
	$scope.$on('place-order-success',function() {
		$ionicLoading.hide();
		$scope.menumodal.hide();
		
		$scope.showAlert('Thank you!' , 'Item added to order!');
		
		$scope.GetOrder();
		
		//Tell everyone to update their table...
		//$scope.sendMessage($scope.chtable , $scope.user , 0 , 'tbl' , 5 , '');
		
	});
	
	$scope.PlaceOrder = function() {
		
		$ionicLoading.show({ template: 'Adding to order...' });
		
		DataService.get(
			'',
			endpoint + '/order/add',
			{ order_id:1 , user_id:$scope.user.id , item:JSON.stringify($scope.orderitem)},
			'place-order-success',								
			'place-order-failed',
			true					
		);
		
	};

	
	$scope.sessions = {};
	
	/*********************************************************************************************
	 * Get Sessions
	 */
  
  	$scope.$on('get-sessions-success',function(event,data) {
  		$scope.sessions = data.data.data.data;
  		$scope.$broadcast('scroll.refreshComplete');
  	});

	$scope.$on('get-sessions-failed',function(event,data) {
	});

	// Perform the login action when the user submits the login form
	$scope.GetActiveSessions = function() {
		
		if ($scope.user.id > 0) {
			DataService.get(
				  'sessions',
				  endpoint + 'session/getactivesessions',
				  { userid : $scope.user.id },
				  'get-sessions-success',
				  'set-sessions-failed',
				  true
			);
		
		}
	};
	
	
	/**
	 * End Get Session
	 *********************************************************************************************/
	
	/*********************************************************************************************
	 * Get Sessions
	 */
  
  	$scope.$on('get-table-success',function(event,data) {
  		$scope.table = data.data.data;
  	});

	$scope.$on('get-table-failed',function(event,data) {
		alert("Failed!");
	});

	// Perform the login action when the user submits the login form
	$scope.GetTable = function() {
		if ($scope.user.id > 0) {
			DataService.get(
				  'table',
				  endpoint + 'table/get',
				  { userid : $scope.user.id },
				  'get-table-success',
				  'set-table-failed',
				  true
			);
		
		}
	};
	
	
	/**
	 * End Get Session
	 *********************************************************************************************/
	
	
	
	angular.element(document).ready(function() {
		
		//Check if user is logged in and get user details
		data = JSON.parse(DataService.getlocal('user'));
		if (data != null) {
			$scope.user = data.data.user;
			$scope.SubscribeToChannels();
			$scope.GetActiveSessions();
			$scope.GetMenu();
			$scope.GetTable();
			$scope.GetOrder();
			//$scope.showPaymentModal();
		}

	});
	
	$scope.$on('session-checkin-success',function(event , data) {
		
		$scope.SetGlobalVariables('session' , data.data.data.data[0].my_session_status);
		
		$scope.SubscribeToChannels();
		$scope.GetActiveSessions();
		
		//If this is 0, request to join the table
		if (data.data.data.data[0].my_session_status == 0) {
			$scope.sendMessage($scope.chtable , $scope.user , 0 , 'tbl' , 1 , '');
		} else {
			$scope.fetchTableRequests();
		}
		
		$scope.GetMenu();
		$scope.GetOrder();
		$scope.GetTable();
		
		$ionicLoading.hide();
		$state.go('app.session');

	});
	
	$scope.$on('session-checkin-failed',function(event , data) {
		$ionicLoading.hide();
	});
	
	$scope.Checkin = function() {
		

			try {
				var platform = $cordovaDevice.getPlatform();
				
				console.log(platform);
	
			    $cordovaBarcodeScanner
			      .scan()
			      .then(function(barcodeData) {
			    	  if (!barcodeData.cancelled) {
			    		  obj = JSON.parse(barcodeData.text);
			    		  $ionicLoading.show({ template: 'Checkin at ' + obj.name });
			    		  
			    		  DataService.get(
		    					'activesession',
		    					endpoint + 'session/checkin',
		    					{ restaurant_id : obj.restaurant, restaurant_branch_id : obj.branch , restaurant_branch_table_id : obj.table , user_id : $scope.user.id },
		    					'session-checkin-success',
		    					'session-checkin-failed',
		    					true
			    		  );
			    	  }
			        // Success! Barcode data is here
			      }, function(error) {
			        // An error occurred
			      });
			} catch (err) {
					$ionicLoading.show({ template: 'Checkin at Brampton'});
	    		  
	    		  DataService.get(
  					'activesession',
  					endpoint + 'session/checkin',
  					{ restaurant_id : 1, restaurant_branch_id : 1 , restaurant_branch_table_id : 1 , user_id : $scope.user.id },
  					'session-checkin-success',
  					'session-checkin-failed',
  					true
	    		  );
			}
		    
		
		//
		
		/**/
		
	};
	
	$scope.PlacePayment = function() {
		var finalPayment = [];
		
		var tmpholder = {
			id : 0,
			amount : ''
		};
		tmpholder.id = $scope.user.id;
		tmpholder.amount = $scope.myorder.totals.amount;
		
		finalPayment.push(tmpholder);
		
		angular.forEach($scope.bill.others , function(v,k) {
			angular.forEach(v, function(v2,k2) {
				if (v2.selected) {
					var tmpholder = {
						id : 0,
						amount : ''
					};
					tmpholder.id = v2.id;
					tmpholder.amount = v2.amount;
					
					finalPayment.push(tmpholder);
				}
			});
		});
		
		DataService.get(
				'make-payment',
				endpoint + 'payment/pay',
				{userid:$scope.user.id , details:JSON.stringify(finalPayment) , sessionid : $scope.sessioninfo.session},
				'payment-success',
				'payment-failed',
				true
		);
		
	};
	
	$scope.AddToTotal = function() {
		$scope.bill.total = $scope.bill.mytotal;
		angular.forEach($scope.bill.others,function(v,k) {
			if(v[0].selected) {
				$scope.bill.total += v[0].amount;
			}
		});
	};
	
	
})

;
