angular.module('starter.services', [])

.service('DataService',['$window','$http','$rootScope',function($window , $http , $rootScope) {
	
	var _this = this;
	var _maxRetryCount = 5; //Just have a maxRetryCount
	
	this.get = function(localname , endpoint , input , success_cb , failed_cb , skip_cache , retries) {
		
		retries = angular.isUndefined(retries) ? _maxRetryCount : retries;
		console.log(retries);
		
		var h = { 'Content-Type': 'application/json' };
		
		if (!skip_cache) {
			
			if (localStorage.getItem(localname) == null) {
				skip_cache = true;
			} else {
				
				//If we have the data, but we feel that this data is to old, we should rather go fetch from the server...
				// TODO : make session timeout variable

				$rootScope.$broadcast(success_cb,{
        			'success': true,
        			'data': JSON.parse(localStorage.getItem(localname))
        		});
				
				skip_cache = false;
				
			}
			
		}

		if (skip_cache) {
			$http.post(endpoint, input, { headers: h }).
	        	then(function(response) {
	        		
	        		//save to cache for use later
	        		
	        		if (localname != '') {
	        			localStorage.setItem(localname,JSON.stringify(response.data));
	        		}
	        		
	        		$rootScope.$broadcast(success_cb,{
	        			'success': true,
	        			'data': response.data
	        		});
	        	
	        	}, function(response) {
	        		
	        		
	        		
	        		if(retries) {
	        			console.log("Retry!!!");
	                    return _this.get(localname , endpoint , input , success_cb , failed_cb , skip_cache, --retries); //here we are returning the promise
	                 }
	        	
	        		$rootScope.$broadcast(failed_cb,{
	        			'success': false,
	        			'data': response.data
	        		});
	        	
	        	}
	        
	        );
			
		};
	}
	
	this.setlocal = function(name,value) {
		localStorage.setItem(name,value);
	};
	
	this.getlocal = function(name) {
		return localStorage.getItem(name);
	}
	
	this.clearCache = function() {
		localStorage.clear();
	}
	
	
	
}])

.service('PubNub',['$window','$http','$rootScope',function($window , $http , $rootScope) {
	
	
	
}])
;